CREATE TABLE ifc_element_transactions (
    id BIGSERIAL PRIMARY KEY,

    -- Core IFC linkage
    parent_guid CHAR(22) NOT NULL,             -- e.g. IfcWall GUID
    event_type VARCHAR(64) NOT NULL,           -- 'component_change', 'property_change', 'geometry_change', 
                                               -- 'element_created', 'element_removed', 'renovation', 
                                               -- 'responsibility_change', 'temporary_modification'

    -- Component change fields (used only when event_type = component_change)
    child_type VARCHAR(64),                    -- e.g. 'IfcWindow' (NULL for wall painting)
    old_child_guid CHAR(22),                   -- previous child GUID
    new_child_guid CHAR(22),                   -- new child GUID

    -- Property or responsibility changes
    property_name VARCHAR(128),                -- e.g. 'FinishMaterial', 'FireRating', 'Maintainer'
    old_value TEXT,                             -- old property value (nullable)
    new_value TEXT,                             -- new property value (nullable)

    -- Metadata
    change_reason TEXT,
    changed_by VARCHAR(128),
    change_timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ifc_transactions_parent ON ifc_element_transactions (parent_guid);
CREATE INDEX idx_ifc_transactions_time ON ifc_element_transactions (change_timestamp);
CREATE INDEX idx_ifc_transactions_type ON ifc_element_transactions (event_type);


-- This trigger prevents UPDATE or DELETE, making the table append-only
CREATE OR REPLACE FUNCTION prevent_modifications()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Updates and deletes are not allowed on ifc_element_transactions table';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_delete
BEFORE UPDATE OR DELETE ON ifc_element_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_modifications();
