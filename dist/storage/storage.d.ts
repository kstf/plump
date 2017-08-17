import { Observable } from 'rxjs';
import { IndefiniteModelData, ModelData, ModelDelta, ModelSchema, ModelReference, BaseStore, StorageOptions } from '../dataTypes';
export declare abstract class Storage implements BaseStore {
    terminal: boolean;
    read$: Observable<ModelData>;
    write$: Observable<ModelDelta>;
    inProgress: {
        [key: string]: Promise<ModelData>;
    };
    types: {
        [type: string]: ModelSchema;
    };
    private readSubject;
    private writeSubject;
    constructor(opts?: StorageOptions);
    abstract readAttributes(value: ModelReference): Promise<ModelData>;
    abstract readRelationship(value: ModelReference, relName: string): Promise<ModelData>;
    readRelationships(item: ModelReference, relationships: string[]): Promise<any>;
    read(item: ModelReference, opts?: string | string[], force?: boolean): Promise<ModelData>;
    _read(item: ModelReference, opts?: string | string[]): Promise<any>;
    bulkRead(item: ModelReference): Promise<ModelData>;
    hot(item: ModelReference): boolean;
    validateInput(value: ModelData | IndefiniteModelData): typeof value;
    getSchema(t: {
        schema: ModelSchema;
    } | ModelSchema | string): ModelSchema;
    addSchema(t: {
        type: string;
        schema: ModelSchema;
    }): Promise<void>;
    addSchemas(a: {
        type: string;
        schema: ModelSchema;
    }[]): Promise<void>;
    fireWriteUpdate(val: ModelDelta): Promise<ModelDelta>;
    fireReadUpdate(val: ModelData): Promise<ModelData>;
}
