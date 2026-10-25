package de.forgeflow.business;

import java.util.function.UnaryOperator;
public interface BusinessStorage {
    BusinessData load(String owner);
    BusinessData mutate(String owner, UnaryOperator<BusinessData> operation);
}
