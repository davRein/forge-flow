package de.forgeflow.time;

public interface TimeTrackingStorage {
    TimeTracking load(String ownerId);
    TimeTracking save(String ownerId, TimeTracking input);
}
