package de.forgeflow.developer;

import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import de.forgeflow.auth.Accounts;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.developer.DeveloperData.Database;

@Component public class DatabaseRunner {
    public record Result(List<String> columns,List<List<String>> rows,int affected,boolean truncated) {}
    public record Prepared(UUID ticket,String sql,boolean readOnly,DatabaseTarget target,String expiresAt) { @Override public String toString(){return "Prepared[sql=REDACTED]";} }
    public record DatabaseTarget(String name,String host,int port,String database,String username) {}
    private record Ticket(String owner,long sessionVersion,Database connection,String sql,boolean readOnly,Instant expires) {}
    private final Set<String> hosts; private final CredentialVault vault; private final DeveloperStorage storage; private final Accounts accounts;
    private final ConcurrentHashMap<UUID,Ticket> tickets=new ConcurrentHashMap<>(); private final Semaphore permits=new Semaphore(2);
    public DatabaseRunner(@Value("${forgeflow.developer.db-hosts:127.0.0.1,localhost,::1}") String hosts,CredentialVault vault,DeveloperStorage storage,Accounts accounts) { this.hosts=new HashSet<>(); for(String host:hosts.split(","))this.hosts.add(host.strip().toLowerCase(Locale.ROOT)); this.vault=vault; this.storage=storage; this.accounts=accounts; }
    public boolean permitted(String host) { return host!=null&&hosts.contains(host.toLowerCase(Locale.ROOT)); }
    public Database find(String owner,UUID id) { return storage.load(owner).connections().stream().filter(value->value.id().equals(id)).findFirst().orElseThrow(()->new ApiFailure(404,"CONNECTION_NOT_FOUND","Datenbankverbindung nicht gefunden.")); }
    private Connection connect(String owner,Database database) throws SQLException {
        if(!permitted(database.host())) throw new ApiFailure(403,"DB_HOST_NOT_ALLOWED","Die Administration muss diesen Datenbankhost in DEV_DB_HOSTS freigeben.");
        var properties=new Properties(); properties.setProperty("user",database.username()); properties.setProperty("password",vault.decrypt(owner+":db:"+database.id(),database.password())); properties.setProperty("sslmode",database.sslMode()); properties.setProperty("connectTimeout","5"); properties.setProperty("loginTimeout","5"); properties.setProperty("socketTimeout","20"); properties.setProperty("cancelSignalTimeout","3"); properties.setProperty("ApplicationName","ForgeFlow DB Scripter");
        String host=database.host().contains(":")?"["+database.host()+"]":database.host();
        return DriverManager.getConnection("jdbc:postgresql://"+host+":"+database.port()+"/"+database.database(),properties);
    }
    public void test(String owner,UUID id) { try(var connection=connect(owner,find(owner,id))) { if(!connection.isValid(3))throw new SQLException("Connection unavailable"); } catch(SQLException error){throw failure(error);} }
    public synchronized Prepared prepare(Accounts.User user,UUID id,String sql,boolean readOnly) {
        SqlPolicy.validate(sql); var connection=find(user.id(),id); var now=Instant.now(); tickets.entrySet().removeIf(entry->!entry.getValue().expires().isAfter(now));
        if(tickets.size()>=500||tickets.values().stream().filter(value->value.owner().equals(user.id())).count()>=5) throw new ApiFailure(429,"DB_BUSY","Bitte vorhandene Ausführungsbestätigungen schließen oder kurz warten.");
        UUID ticket=UUID.randomUUID(); var value=new Ticket(user.id(),user.sessionVersion(),connection,sql,readOnly,now.plusSeconds(120)); tickets.put(ticket,value);
        return new Prepared(ticket,sql,readOnly,new DatabaseTarget(connection.name(),connection.host(),connection.port(),connection.database(),connection.username()),value.expires().toString());
    }
    public List<Result> execute(Accounts.User user,UUID id) {
        var ticket=tickets.get(id);
        if(ticket==null||!ticket.owner().equals(user.id()))throw new ApiFailure(404,"SQL_CONFIRMATION_NOT_FOUND","Ausführungsbestätigung nicht gefunden.");
        if(!ticket.expires().isAfter(Instant.now())||ticket.sessionVersion()!=user.sessionVersion()||!ticket.connection().equals(find(user.id(),ticket.connection().id()))) { tickets.remove(id,ticket); throw new ApiFailure(409,"SQL_CONFIRMATION_EXPIRED","Bestätigung abgelaufen oder Verbindung geändert. Bitte erneut prüfen."); }
        if(!permits.tryAcquire())throw new ApiFailure(429,"DB_BUSY","Es laufen bereits Datenbankabfragen. Bitte kurz warten.");
        try {
            if(!tickets.remove(id,ticket))throw new ApiFailure(409,"SQL_ALREADY_EXECUTED","Diese Bestätigung wurde bereits verwendet.");
            try(var connection=connect(user.id(),ticket.connection())) {
                connection.setReadOnly(ticket.readOnly()); connection.setAutoCommit(false);
                try {
                    try(var setup=connection.createStatement()) { setup.execute("SET LOCAL statement_timeout='15s'"); setup.execute("SET LOCAL lock_timeout='3s'"); }
                    var results=new ArrayList<Result>(); long characters=0;
                    try(var statement=connection.createStatement()) {
                        statement.setQueryTimeout(15); statement.setMaxRows(201); statement.setFetchSize(50); statement.setMaxFieldSize(4096);
                        boolean hasRows=statement.execute(ticket.sql());
                        for(int index=0;index<20;index++) {
                            if(hasRows) { try(var rows=statement.getResultSet()) {
                                var metadata=rows.getMetaData(); if(metadata.getColumnCount()>50)throw new ApiFailure(413,"DB_RESULT_LIMIT","Die Abfrage liefert zu viele Spalten.");
                                var columns=new ArrayList<String>(); for(int column=1;column<=metadata.getColumnCount();column++) columns.add(metadata.getColumnLabel(column));
                                var values=new ArrayList<List<String>>(); boolean truncated=false;
                                while(rows.next()) { if(values.size()==200){truncated=true;break;} var line=new ArrayList<String>(); for(int column=1;column<=columns.size();column++){String value=rows.getString(column); if(value!=null&&value.length()>4000)value=value.substring(0,4000)+"…"; characters+=value==null?0:value.length(); if(characters>1000000)throw new ApiFailure(413,"DB_RESULT_LIMIT","Das Abfrageergebnis ist zu groß. Bitte stärker eingrenzen."); line.add(value);} values.add(line); }
                                results.add(new Result(columns,values,-1,truncated));
                            } } else { int affected=statement.getUpdateCount(); if(affected==-1)break; results.add(new Result(List.of(),List.of(),affected,false)); }
                            hasRows=statement.getMoreResults(Statement.CLOSE_CURRENT_RESULT);
                        }
                    }
                    accounts.findById(user.id()).filter(value->value.active()&&value.sessionVersion()==user.sessionVersion()).orElseThrow(()->new ApiFailure(401,"UNAUTHENTICATED","Die Sitzung ist nicht mehr gültig."));
                    connection.commit(); return results;
                } catch(RuntimeException|SQLException error) { try{connection.rollback();}catch(SQLException ignored){} throw error; }
            } catch(SQLException error) { throw failure(error); }
        } finally { permits.release(); }
    }
    private ApiFailure failure(SQLException error) { String state=error.getSQLState(); return new ApiFailure(422,"DATABASE_ERROR","Datenbankfehler"+(state!=null&&state.matches("[A-Z0-9]{5}")?" (SQLSTATE "+state+")":"")+". Verbindung, Berechtigungen und SQL prüfen; offene Transaktion wurde nicht bestätigt."); }
}
