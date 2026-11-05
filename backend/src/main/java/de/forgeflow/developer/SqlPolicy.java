package de.forgeflow.developer;

import java.util.*;
import java.util.regex.*;
import de.forgeflow.api.ApiFailure;

/** Keeps transaction boundaries under server control while accepting quoted procedural bodies. */
public final class SqlPolicy {
    private SqlPolicy() {}
    public static void validate(String sql) {
        if(sql==null||sql.isBlank()||sql.length()>100000||sql.indexOf('\0')>=0) throw invalid();
        int i=0,statements=0; boolean first=true;
        while(i<sql.length()) {
            char c=sql.charAt(i);
            if(Character.isWhitespace(c)) { i++; continue; }
            if(sql.startsWith("--",i)) { int end=sql.indexOf('\n',i+2); i=end<0?sql.length():end+1; continue; }
            if(sql.startsWith("/*",i)) { int depth=1; i+=2; while(i<sql.length()&&depth>0) { if(sql.startsWith("/*",i)){depth++;i+=2;} else if(sql.startsWith("*/",i)){depth--;i+=2;}else i++; } if(depth!=0)throw invalid(); continue; }
            if(c==';') { first=true; i++; continue; }
            if(c=='\''||c=='"') {
                boolean escaped=c=='\''&&i>0&&(sql.charAt(i-1)=='E'||sql.charAt(i-1)=='e')&&(i<2||!Character.isLetterOrDigit(sql.charAt(i-2)));
                char quote=c; i++; boolean closed=false;
                while(i<sql.length()) { char next=sql.charAt(i++); if(escaped&&next=='\\'&&i<sql.length()){i++;continue;} if(next==quote){if(i<sql.length()&&sql.charAt(i)==quote)i++;else{closed=true;break;}} }
                if(!closed)throw invalid(); first=false; continue;
            }
            if(c=='$') { var matcher=Pattern.compile("\\$(?:[A-Za-z_][A-Za-z0-9_]*)?\\$").matcher(sql); matcher.region(i,sql.length()); if(matcher.lookingAt()) { String delimiter=matcher.group(); int end=sql.indexOf(delimiter,matcher.end()); if(end<0)throw invalid(); i=end+delimiter.length(); first=false; continue; } }
            if(Character.isLetter(c)||c=='_') {
                int start=i++; while(i<sql.length()&&(Character.isLetterOrDigit(sql.charAt(i))||sql.charAt(i)=='_'))i++;
                String word=sql.substring(start,i).toUpperCase(Locale.ROOT);
                if(first) { if(Set.of("BEGIN","END","START","COMMIT","ROLLBACK","ABORT","SAVEPOINT","RELEASE","PREPARE","DISCARD","SET","RESET","VACUUM").contains(word)) throw new ApiFailure(422,"SQL_TRANSACTION_CONTROL","Transaktionssteuerung und Sitzungseinstellungen werden vom DB Scripter verwaltet."); if(++statements>20)throw invalid(); }
                first=false; continue;
            }
            if(first) throw invalid(); i++;
        }
        if(statements==0)throw invalid();
    }
    private static ApiFailure invalid() { return new ApiFailure(422,"INVALID_SQL","Bitte ein gültiges SQL-Skript mit höchstens 20 Anweisungen und 100000 Zeichen angeben."); }
}
