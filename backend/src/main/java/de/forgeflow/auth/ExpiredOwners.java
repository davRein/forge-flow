package de.forgeflow.auth;
import java.util.HashSet;
import java.util.Set;
import de.forgeflow.api.ApiFailure;
/** Memory-adapter tombstones prevent in-flight requests from recreating deleted trial data. */
public final class ExpiredOwners {
    private final Set<String> owners=new HashSet<>();
    public void mark(String owner){owners.add(owner);}
    public boolean contains(String owner){return owners.contains(owner);}
    public void reject(String owner){if(contains(owner))throw new ApiFailure(401,"UNAUTHENTICATED","Die Sitzung ist abgelaufen. Bitte erneut anmelden.");}
}
