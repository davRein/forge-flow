package de.forgeflow.business;
import java.util.*;
public interface PortalStorage {
    Optional<PortalLink> find(String user);
    List<PortalLink> list(String owner);
    PortalLink save(PortalLink link, java.util.function.UnaryOperator<PortalLink> publish);
    default PortalLink save(PortalLink link) { return save(link, java.util.function.UnaryOperator.identity()); }
}
