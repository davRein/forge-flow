package de.forgeflow;
import org.springframework.test.context.*;
@ActiveProfiles(value="postgres",inheritProfiles=false)
class DeveloperPostgresIntegrationTest extends DeveloperIntegrationTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry){AiTestDatabase.configure(registry,"developer-http-");}
    @org.junit.jupiter.api.Test
    @org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="TEST_POSTGRES_URL",matches=".+")
    void sqlRunsOnlyAfterConfirmationEnforcesReadOnlyAndRollsBackFailedScripts()throws Exception{
        String url=System.getenv("TEST_POSTGRES_URL");var uri=java.net.URI.create(url.substring(5));
        String name=uri.getPath().substring(1),username=System.getenv().getOrDefault("TEST_POSTGRES_USER","forgeflow_test"),password=System.getenv().getOrDefault("TEST_POSTGRES_PASSWORD","");
        var owner=owner();var id=java.util.UUID.randomUUID();
        var target=new de.forgeflow.developer.DeveloperData.Database(id,"Isolated test",uri.getHost(),uri.getPort(),name,username,"disable",vault.encrypt(owner.id()+":db:"+id,password));
        developers.mutate(owner.id(),before->before.connections(java.util.List.of(target)));database.test(owner.id(),id);
        String table="ff_dbscripter_probe_"+java.util.UUID.randomUUID().toString().replace("-","");
        try(var connection=java.sql.DriverManager.getConnection(url,username,password);var statement=connection.createStatement()){
            statement.execute("CREATE TABLE "+table+" (id int PRIMARY KEY)");
            try{
                var confirmed=database.prepare(owner,id,"INSERT INTO "+table+" VALUES (1)",false);
                try(var result=statement.executeQuery("SELECT count(*) FROM "+table)){result.next();org.assertj.core.api.Assertions.assertThat(result.getInt(1)).isZero();}
                org.assertj.core.api.Assertions.assertThat(database.execute(owner,confirmed.ticket()).getFirst().affected()).isEqualTo(1);
                org.assertj.core.api.Assertions.assertThatThrownBy(()->database.execute(owner,confirmed.ticket())).isInstanceOf(de.forgeflow.api.ApiFailure.class);
                var readonly=database.prepare(owner,id,"INSERT INTO "+table+" VALUES (2)",true);
                org.assertj.core.api.Assertions.assertThatThrownBy(()->database.execute(owner,readonly.ticket())).isInstanceOf(de.forgeflow.api.ApiFailure.class).hasMessageContaining("25006").hasMessageNotContaining(table).hasMessageNotContaining(password);
                var broken=database.prepare(owner,id,"INSERT INTO "+table+" VALUES (3); INSERT INTO "+table+" VALUES (1)",false);
                org.assertj.core.api.Assertions.assertThatThrownBy(()->database.execute(owner,broken.ticket())).isInstanceOf(de.forgeflow.api.ApiFailure.class);
                try(var result=statement.executeQuery("SELECT count(*) FROM "+table)){result.next();org.assertj.core.api.Assertions.assertThat(result.getInt(1)).isEqualTo(1);}
                var query=database.prepare(owner,id,"SELECT generate_series(1,300)",true);var rows=database.execute(owner,query.ticket()).getFirst();org.assertj.core.api.Assertions.assertThat(rows.rows()).hasSize(200);org.assertj.core.api.Assertions.assertThat(rows.truncated()).isTrue();
            }finally{statement.execute("DROP TABLE "+table);}
        }
    }
}
