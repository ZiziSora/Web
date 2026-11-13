import { authentication, type AuthDependencies } from './auth.js';
import express, { type Request, type Response, type NextFunction } from 'express';
import { parseListQuery, parseOptionsQuery } from './list-query.js';
import { resources, parseId, jsonInput, InputError, NotFoundError, IngredientInUseError, type RestaurantStore } from './domain.js';
export function createApp(store: RestaurantStore, options: {
    auth: AuthDependencies;
    origin?: string;
    logger?: {
        error(message: string): void;
    };
}) {
    const auth = authentication(options.auth);
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', options.auth.config.trustProxyHops);
    const origin = options.origin ?? process.env.SPA_ORIGIN ?? 'http://localhost:5179';
    if (new URL(origin).origin !== origin)
        throw new Error('SPA_ORIGIN phải là origin hợp lệ.');
    app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.vary('Origin'); if (req.headers.origin === origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Expose-Headers', 'Retry-After');
    } if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    } next(); });
    app.use(express.json({ limit: '32kb' }));
    app.use(auth.sessionMiddleware, auth.initialize);
    // Mount authorization through Express routing so matching (including case
    // handling) is identical to the resource routes themselves.
    app.use(['/api/chefs', '/api/ingredients'], auth.requireLogin);
    app.use('/api/dishes', (req, res, next) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return auth.requireLogin(req, res, next);
        next();
    });
    app.use((req, res, next) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== origin) {
            res.status(403).json({ ok: false, error: { code: 'CSRF_INVALID', message: 'Origin không hợp lệ.' } }); return;
        }
        next();
    });
    app.use(auth.csrf);
    app.use('/api/auth', auth.router);
    for (const resource of resources) {
        const base = `/api/${resource}`;
        const idOf = (req: Request) => { const id = parseId(req.params.id); if (!id)
            throw new NotFoundError(); return id; };
        app.get(base, async (req, res) => res.json({ ok: true, data: await store.list(resource, parseListQuery(resource, req.query)) }));
        if (resource === 'dishes') app.get(`${base}/facets`, async (_req, res) => res.json({ ok: true, data: await store.facets() }));
        else {
            app.get(`${base}/all`, async (_req, res) => res.json({ ok: true, data: await store.all(resource) }));
            app.get(`${base}/options/all`, async (_req, res) => res.json({ ok: true, data: await store.allOptions(resource) }));
            app.get(`${base}/options`, async (req, res) => res.json({ ok: true, data: await store.options(resource, parseOptionsQuery(req.query)) }));
        }
        app.get(`${base}/:id`, async (req, res) => { const data = await store.find(resource, idOf(req)); if (!data)
            throw new NotFoundError(); res.json({ ok: true, data }); });
        app.post(base, async (req, res) => res.json({ ok: true, data: await store.create(resource, jsonInput(resource, req.body) as Parameters<RestaurantStore['create']>[1]) }));
        app.patch(`${base}/:id`, async (req, res) => { const id = idOf(req); if (!await store.find(resource, id))
            throw new NotFoundError(); res.json({ ok: true, data: await store.update(resource, id, jsonInput(resource, req.body, true)) }); });
        app.delete(`${base}/:id`, async (req, res) => { await store.delete(resource, idOf(req)); res.json({ ok: true, data: null }); });
    }
    app.use((_req, res) => res.status(404).json({ message: 'Không tìm thấy đường dẫn API.' }));
    app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
        if (error instanceof NotFoundError)
            return res.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi.' } });
        if (error instanceof IngredientInUseError)
            return res.json({ ok: false, error: { code: 'VALIDATION_FAILED', message: 'Chưa thể xóa nguyên liệu đang được sử dụng.', fields: { form: 'Hãy gỡ nguyên liệu khỏi các món trước khi xóa.' }, details: { dishes: error.dishes } } });
        if (error instanceof InputError)
            return res.json({ ok: false, error: { code: 'VALIDATION_FAILED', message: 'Vui lòng kiểm tra thông tin.', fields: error.errors } });
        const status = (error as {
            status?: number;
        })?.status;
        if (status === 400 || status === 413)
            return res.status(status).json({ message: 'JSON không hợp lệ hoặc vượt giới hạn.' });
        (options.logger ?? console).error('Không thể xử lý yêu cầu. Kiểm tra cấu hình máy chủ và database.');
        return res.status(500).json({ message: 'Không thể đọc hoặc lưu dữ liệu. Vui lòng thử lại sau.' });
    });
    return app;
}
