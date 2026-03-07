import { API_BASE_URL } from './constants';
import { z } from 'zod';
import type {
    Character,
    CharacterDetail,
    Collection,
    GalleryItem,
    ModelUsage,
    Prompt,
    PromptTag,
    PromptVersion,
    Tag,
    UserProfile,
} from './types';

// LOCAL ADAPTER REPLACING API CLIENT
const API_URL = `${API_BASE_URL}/api`;

type QueryError = {
    message: string;
    code: string;
    details?: string;
    hint?: string;
};

type QueryResult<TRow> = {
    data: TRow[] | null;
    error: QueryError | null;
    count?: number;
};

type QuerySingleResult<TRow> = {
    data: TRow | null;
    error: QueryError | null;
};

type FilterValue = string | number | boolean | null;

type DbTableMap = {
    prompts: Prompt;
    tags: Tag;
    prompt_tags: PromptTag;
    prompt_versions: PromptVersion;
    characters: Character;
    character_details: CharacterDetail;
    gallery_items: GalleryItem;
    collections: Collection;
    model_usage: ModelUsage;
    user_profiles: UserProfile;
};

const nullableNumberFromUnknown = z.preprocess((value) => {
    if (value === null || value === undefined || value === '') {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
}, z.number().nullable().optional());

const promptSchema = z.object({
    id: z.string(),
    title: z.string().nullable().optional(),
    content: z.string(),
    notes: z.string().nullable().optional(),
    rating: nullableNumberFromUnknown,
    is_template: z.boolean().nullable().optional(),
    is_favorite: z.boolean().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    gallery_item_id: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    suggested_model: z.string().nullable().optional(),
    revised_prompt: z.string().nullable().optional(),
    seed: nullableNumberFromUnknown,
    aspect_ratio: z.string().nullable().optional(),
    use_custom_aspect_ratio: z.boolean().nullable().optional(),
    start_image: z.string().nullable().optional(),
    generation_journey: z.array(z.object({ step: z.string(), label: z.string() })).nullable().optional(),
    negative_prompt: z.string().nullable().optional(),
}).passthrough();

const tagSchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
}).passthrough();

const promptTagSchema = z.object({
    prompt_id: z.string(),
    tag_id: z.string(),
}).passthrough();

const promptVersionSchema = z.object({
    id: z.string(),
    prompt_id: z.string(),
    content: z.string(),
    version_number: z.preprocess((value) => {
        if (typeof value === 'string') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : value;
        }
        return value;
    }, z.number()),
    change_description: z.string().nullable().optional(),
    created_at: z.string(),
    model: z.string().nullable().optional(),
}).passthrough();

const characterDetailSchema = z.object({
    id: z.string(),
    character_id: z.string(),
    category: z.string(),
    detail: z.string(),
    works_well: z.boolean().nullable().optional(),
    created_at: z.string().nullable().optional(),
}).passthrough();

const characterSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    reference_image_url: z.string().nullable().optional(),
    images: z.array(z.object({ id: z.string(), url: z.string(), isMain: z.boolean(), created_at: z.string() })).nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
}).passthrough();

const galleryItemSchema = z.object({
    id: z.string(),
    title: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
    prompt_used: z.string().nullable().optional(),
    prompt_id: z.string().nullable().optional(),
    character_id: z.string().nullable().optional(),
    rating: nullableNumberFromUnknown,
    collection_id: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    aspect_ratio: z.string().nullable().optional(),
    start_image: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    media_type: z.enum(['image', 'video']).nullable().optional(),
    video_url: z.string().nullable().optional(),
    video_local_path: z.string().nullable().optional(),
    thumbnail_url: z.string().nullable().optional(),
    duration_seconds: nullableNumberFromUnknown,
    storage_mode: z.enum(['url', 'local', 'both']).nullable().optional(),
}).passthrough();

const collectionSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    created_at: z.string(),
}).passthrough();

const modelUsageSchema = z.object({
    id: z.string(),
    model_id: z.string().nullable().optional(),
    prompt_used: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    rating: nullableNumberFromUnknown,
    is_keeper: z.boolean().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string(),
}).passthrough();

const userProfileSchema = z.object({
    id: z.string(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
}).passthrough();

const TABLE_RESPONSE_SCHEMAS = {
    prompts: promptSchema,
    tags: tagSchema,
    prompt_tags: promptTagSchema,
    prompt_versions: promptVersionSchema,
    characters: characterSchema,
    character_details: characterDetailSchema,
    gallery_items: galleryItemSchema,
    collections: collectionSchema,
    model_usage: modelUsageSchema,
    user_profiles: userProfileSchema,
} satisfies Partial<Record<keyof DbTableMap, z.ZodTypeAny>>;

function validateRowsForTable(table: string, rows: unknown[]) {
    const schema = TABLE_RESPONSE_SCHEMAS[table as keyof DbTableMap];
    if (!schema) {
        return { success: true as const, data: rows };
    }

    const parsed = z.array(schema).safeParse(rows);
    if (parsed.success) {
        return { success: true as const, data: parsed.data };
    }

    const issue = parsed.error.issues[0];
    return {
        success: false as const,
        error: {
            message: `Schema validation failed for table "${table}"`,
            code: 'SCHEMA_VALIDATION_ERROR',
            details: issue ? `${issue.path.join('.') || '<root>'}: ${issue.message}` : parsed.error.message,
            hint: 'Update frontend table row types or backend response shape to match.',
        } satisfies QueryError,
    };
}

class LocalApiClient {


    from<TTable extends keyof DbTableMap>(table: TTable): QueryBuilder<DbTableMap[TTable]>;
    from(table: string): QueryBuilder<Record<string, unknown>>;
    from(table: string) {
        return new QueryBuilder(table);
    }

    // Mock functions object for edge function calls
    functions = {
        invoke: async (functionName: string, options?: { body?: Record<string, unknown> }) => {
            console.log(`🔄 Edge function call intercepted: ${functionName}`);

            // Redirect edge function calls to local API
            if (functionName === 'manage-api-keys') {
                return this.handleApiKeyOperation(options?.body);
            }

            return { data: null, error: { message: 'Function not implemented locally' } };
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async handleApiKeyOperation(body: any) {
        const { action } = body || {};

        try {
            switch (action) {
                case 'list': {
                    const listRes = await fetch(`${API_URL}/user_api_keys`);
                    const keys = await listRes.json();
                    return { data: keys, error: null };
                }

                case 'save': {
                    const saveRes = await fetch(`${API_URL}/user_api_keys`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const saved = await saveRes.json();
                    return { data: saved, error: null };
                }

                case 'delete': {
                    const { provider } = body;
                    const deleteRes = await fetch(`${API_URL}/user_api_keys/${provider}`, {
                        method: 'DELETE'
                    });
                    const deleted = await deleteRes.json();
                    return { data: deleted, error: null };
                }

                case 'test': {
                    const testRes = await fetch(`${API_URL}/user_api_keys/test`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const testResult = await testRes.json();
                    return { data: testResult, error: null };
                }

                default:
                    return { data: null, error: { message: 'Unknown action' } };
            }
        } catch (error) {
            console.error('API key operation error:', error);
            return { data: null, error };
        }
    }

    /**
     * Finds prompts similar to the provided content using pg_trgm similarity
     */
    async findSimilarPrompts(content: string, limit = 5, threshold = 0.5) {
        try {
            const params = new URLSearchParams({
                content,
                limit: limit.toString(),
                threshold: threshold.toString()
            });
            const res = await fetch(`${API_URL}/prompts/similar?${params.toString()}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to find similar prompts');
            }
            const data = await res.json();
            return { data, error: null };
        } catch (error: any) {
            console.error('Similarity search error:', error);
            return { data: null, error };
        }
    }
}

class QueryBuilder<TRow extends object = Record<string, unknown>> {
    table: string;
    url: string;
    filters: Record<string, FilterValue> = {};
    orderBy: { column: string; ascending: boolean } | null = null;
    limitValue: number | null = null;
    offsetValue: number | null = null;

    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET';
    body: Record<string, unknown> | Record<string, unknown>[] | null = null;

    constructor(table: string) {
        this.table = table;
        this.url = `${API_URL}/${table}`;
    }

    select(_columns = '*', _options?: Record<string, unknown>) {
        if (this.method === 'POST' || this.method === 'PUT' || this.method === 'DELETE') {
            return this;
        }
        this.method = 'GET';
        // Suppress unused vars
        void _columns;
        void _options;
        return this;
    }

    eq(column: string, value: FilterValue) {
        if (column === 'user_id') {
            // Ignore user_id filters for local mode
            return this;
        } else if (column === 'id') {
            this.url = `${API_URL}/${this.table}/${value}`;
        }
        this.filters[column] = value;
        return this;
    }

    neq(column: string, value: FilterValue) {
        if (column === 'user_id') return this;
        this.filters[column] = `neq.${value}`;
        return this;
    }

    gte(column: string, value: FilterValue) {
        this.filters[column] = `gte.${value}`;
        return this;
    }

    gt(column: string, value: FilterValue) {
        this.filters[column] = `gt.${value}`;
        return this;
    }

    lte(column: string, value: FilterValue) {
        this.filters[column] = `lte.${value}`;
        return this;
    }

    lt(column: string, value: FilterValue) {
        this.filters[column] = `lt.${value}`;
        return this;
    }

    in(column: string, values: (string | number)[]) {
        if (column === 'user_id') return this;
        if (values && values.length > 0) {
            this.filters[column] = `in.(${values.join(',')})`;
        }
        return this;
    }

    order(column: string, options?: { ascending?: boolean }) {
        // Send order as query param: sort_col.desc or sort_col.asc
        // My simple crud.js expects "column.desc"
        const dir = options?.ascending ? 'asc' : 'desc';
        this.filters['order'] = `${column}.${dir}`;
        return this;
    }

    limit(count: number) {
        this.limitValue = count;
        return this;
    }

    range(from: number, to: number) {
        this.offsetValue = from;
        this.limitValue = to - from + 1;
        return this;
    }

    maybeSingle() {
        return this.executeSingle();
    }

    single() {
        return this.executeSingle();
    }

    async executeSingle() {
        // Reuse query logic but expect one result
        return new Promise<QuerySingleResult<TRow>>((resolve) => {
            this.then((res: QueryResult<TRow>) => {
                if (res.error) {
                    resolve({ data: null, error: res.error });
                } else if (Array.isArray(res.data) && res.data.length > 0) {
                    resolve({ data: res.data[0], error: null });
                } else {
                    resolve({ data: null, error: { message: 'Row not found', code: 'PGRST116' } });
                }
            });
        });
    }

    async then(resolve: (value: QueryResult<TRow>) => void) {
        try {
            let url = this.url;
            const params = new URLSearchParams();

            // Only append params for GET or DELETE (sometimes)
            // For POST/PUT with body, we usually don't need params unless it's specific args
            // But our local crud.js uses path params for ID update, which is handled in .eq()

            if (this.limitValue) params.append('limit', this.limitValue.toString());
            if (this.offsetValue) params.append('offset', this.offsetValue.toString());

            Object.entries(this.filters).forEach(([key, value]) => {
                // don't append filters if we are using ID in path for single item ops
                if (key === 'id' && url.includes(`/${value}`)) return;
                params.append(key, String(value));
            });

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const options: RequestInit = {
                method: this.method,
                headers: { 'Content-Type': 'application/json' }
            };

            if (this.body && (this.method === 'POST' || this.method === 'PUT')) {
                options.body = JSON.stringify(this.body);
            }

            const response = await fetch(url, options);

            if (!response.ok) {
                let errorMsg = `HTTP ${response.status}`;
                let errorCode = `HTTP_${response.status}`;
                let errorDetails = '';
                let errorHint = '';

                try {
                    const errorText = await response.text();
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.error || errorJson.message || errorMsg;
                    errorCode = errorJson.code || errorCode;
                    errorDetails = errorJson.details || '';
                    errorHint = errorJson.hint || '';
                } catch {
                    // ignore json parse error
                }
                const error = {
                    message: errorMsg,
                    code: errorCode,
                    details: errorDetails,
                    hint: errorHint
                };
                return resolve({ data: null, error });
            }

            // DELETE might return empty or status only
            if (this.method === 'DELETE') {
                return resolve({ data: null, error: null });
            }

            const text = await response.text();

            // Handle empty response
            if (!text || text.trim() === '') {
                return resolve({ data: [], error: null, count: 0 });
            }

            const data = JSON.parse(text);
            const normalized = Array.isArray(data) ? data : [data];
            const validation = validateRowsForTable(this.table, normalized);

            if (!validation.success) {
                return resolve({ data: null, error: validation.error });
            }

            resolve({
                data: validation.data as TRow[],
                error: null,
                count: validation.data.length,
            });
        } catch (error: unknown) {
            console.error('Query execution error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            resolve({ data: null, error: { message: errorMessage, code: 'UNKNOWN_ERROR', details: '', hint: '' } });
        }
    }

    insert(data: Partial<TRow> | Partial<TRow>[]) {
        this.method = 'POST';
        if (Array.isArray(data)) {
            // Strip user_id from each item
            this.body = data.map((item) => {
                const clean = { ...item } as Record<string, unknown>;
                delete clean.user_id;
                return clean;
            });
        } else {
            // Strip user_id
            const cleanData = { ...data } as Record<string, unknown>;
            delete cleanData.user_id;
            this.body = cleanData;
        }
        return this;
    }

    upsert(data: Partial<TRow> | Partial<TRow>[], options?: { onConflict: string }) {
        this.method = 'POST';
        if (Array.isArray(data)) {
            // Strip user_id from each item
            this.body = data.map((item) => {
                const clean = { ...item } as Record<string, unknown>;
                delete clean.user_id;
                return clean;
            });
        } else {
            // Strip user_id
            const cleanData = { ...data } as Record<string, unknown>;
            delete cleanData.user_id;
            this.body = cleanData;
        }

        if (options?.onConflict) {
            this.filters['onConflict'] = options.onConflict;
        }
        return this;
    }

    delete() {
        this.method = 'DELETE';
        return this;
    }

    update(data: Partial<TRow>) {
        this.method = 'PUT';
        // Strip user_id
        const cleanData = { ...data } as Record<string, unknown>;
        delete cleanData.user_id;
        this.body = cleanData;
        return this;
    }

}

export const dbStrict = new LocalApiClient();

// Backward-compatible export for legacy call sites that still rely on loose typing.
// Prefer `dbStrict` in new code to get generic typing plus zod-backed response validation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = dbStrict;
