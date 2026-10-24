package de.forgeflow.rest;

public interface RestCollectionsStorage {
    RestCollections load(String ownerId);
    RestCollections save(String ownerId, RestCollections input);
}
