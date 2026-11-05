package de.forgeflow.developer;
import java.util.function.UnaryOperator;
public interface DeveloperStorage {
    DeveloperData load(String owner);
    DeveloperData mutate(String owner, UnaryOperator<DeveloperData> operation);
}
