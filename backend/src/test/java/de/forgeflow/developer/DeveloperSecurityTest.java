package de.forgeflow.developer;

import java.util.*;
import org.junit.jupiter.api.Test;
import de.forgeflow.api.ApiFailure;
import static org.assertj.core.api.Assertions.*;

class DeveloperSecurityTest {
    private CredentialVault vault(){return new CredentialVault(Base64.getEncoder().encodeToString(new byte[32]));}
    @Test void vaultUsesRandomNoncesAndBindsCiphertextToOwnerAndConnection(){
        var vault=vault();String first=vault.encrypt("a:db:1","test-only-secret"),second=vault.encrypt("a:db:1","test-only-secret");
        assertThat(first).isNotEqualTo(second).doesNotContain("test-only-secret");
        assertThat(vault.decrypt("a:db:1",first)).isEqualTo("test-only-secret");
        assertThatThrownBy(()->vault.decrypt("b:db:1",first)).isInstanceOf(ApiFailure.class).hasMessageNotContaining("test-only-secret");
        assertThatThrownBy(()->vault.decrypt("a:db:2",first)).isInstanceOf(ApiFailure.class);
        assertThatThrownBy(()->vault.decrypt("a:db:1",first.substring(0,first.length()-4)+"AAAA")).isInstanceOf(ApiFailure.class);
        assertThatThrownBy(()->new CredentialVault("").encrypt("a","x")).isInstanceOf(ApiFailure.class);
        assertThatThrownBy(()->new CredentialVault("bad-key")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void sqlScannerAllowsQuotedSemicolonsNestedCommentsAndProceduralBodies(){
        for(String sql:List.of("select ';COMMIT;', '\\'; -- COMMIT\n SELECT 2", "/*outer /*inner;*/ comment*/ SELECT \"COMMIT\" FROM sample;", "DO $body$ BEGIN RAISE NOTICE 'done;'; END $body$; SELECT 2", "select E'escaped\\\'; quote'", "CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END $$ LANGUAGE plpgsql;", "WITH data AS (SELECT 1) SELECT * FROM data"))assertThatCode(()->SqlPolicy.validate(sql)).doesNotThrowAnyException();
    }
    @Test void sqlScannerBlocksTransactionEscapesAndMalformedOrExcessiveScripts(){
        for(String word:List.of("BEGIN","END","START TRANSACTION","COMMIT","ROLLBACK","ABORT","SAVEPOINT a","RELEASE a","PREPARE TRANSACTION 'a'","DISCARD ALL","SET ROLE postgres","RESET ALL","VACUUM"))
            assertThatThrownBy(()->SqlPolicy.validate("SELECT 1; /*gap*/ "+word)).isInstanceOf(ApiFailure.class);
        for(String sql:List.of("", "-- comment", "select 'unclosed", "select $$unclosed", "select 1 /* unclosed", "select 1\0", "select 1;".repeat(21), "x".repeat(100001)))assertThatThrownBy(()->SqlPolicy.validate(sql)).isInstanceOf(ApiFailure.class);
    }
    @Test void preparedSqlIsOwnerBoundSingleUseAndInvalidatedByCredentialChanges(){
        var storage=new MemoryDeveloperStorage();var vault=vault(); var accounts=org.mockito.Mockito.mock(de.forgeflow.auth.Accounts.class);
        var runner=new DatabaseRunner("localhost",vault,storage,accounts);var owner=new de.forgeflow.auth.Accounts.User("a","a@example.test","A","test-only-hash");
        UUID id=UUID.randomUUID(); var connection=new DeveloperData.Database(id,"Test","localhost",1,"not_connected","test","disable",vault.encrypt("a:db:"+id,"test-only-password"));
        storage.mutate("a",data->data.connections(List.of(connection)));
        var ticket=runner.prepare(owner,id,"SELECT 1",true);
        assertThat(ticket.sql()).isEqualTo("SELECT 1");assertThat(ticket.target().database()).isEqualTo("not_connected");
        var other=new de.forgeflow.auth.Accounts.User("b","b@example.test","B","test-only-hash");
        assertThatThrownBy(()->runner.execute(other,ticket.ticket())).isInstanceOf(ApiFailure.class).hasMessageContaining("nicht gefunden");
        storage.mutate("a",data->data.connections(List.of(new DeveloperData.Database(id,"Changed","localhost",1,"not_connected","test","disable",connection.password()))));
        assertThatThrownBy(()->runner.execute(owner,ticket.ticket())).isInstanceOf(ApiFailure.class).hasMessageContaining("geändert");
        assertThatThrownBy(()->runner.execute(owner,ticket.ticket())).isInstanceOf(ApiFailure.class).hasMessageContaining("nicht gefunden");
        var versioned=runner.prepare(owner,id,"select 2",false);
        assertThatThrownBy(()->runner.execute(new de.forgeflow.auth.Accounts.User(owner.id(),owner.email(),owner.name(),owner.passwordHash(),false,true,1),versioned.ticket())).isInstanceOf(ApiFailure.class).hasMessageContaining("geändert");
    }
}
