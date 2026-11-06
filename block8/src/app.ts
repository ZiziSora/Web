import { parseListQuery, type ListQuery } from './list-query.js';
import { listState, listUrl } from './navigation.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import methodOverride from 'method-override';
import { authentication, type AuthDependencies } from './auth.js';
import {
  resources, labels, money, parseId, formValues, entityValues, validate,
  InputError, NotFoundError, IngredientInUseError,
  type RestaurantStore, type Resource, type FormValues, type Errors, type Entity,
} from './domain.js';

export function createApp(store: RestaurantStore, options: { root?: string; logger?: { error(message: string): void }; auth: AuthDependencies }) {
  const app = express();
  const auth = authentication(options.auth);
  app.set('trust proxy', options.auth.config.trustProxyHops);
  const root = options.root ?? fileURLToPath(new URL(import.meta.url.includes('/dist/') ? '../../' : '../', import.meta.url));
  const secret = randomBytes(32);
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(root, 'views'));
  app.locals = { ...app.locals, labels, money, listUrl };
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; img-src 'self' data:; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');
    res.locals = { ...res.locals, admin: req.path.startsWith('/admin'), resource: '', pageTitle: 'The Table', q: '', currentUser: null, csrf: '' };
    next();
  });
  app.use(express.static(path.join(root, 'public')));
  app.use(express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 500 }));
  app.use(methodOverride(req => {
    if (req.method === 'POST' && ['PATCH', 'DELETE'].includes(req.body?._method)) return req.body._method;
  }, { methods: ['POST'] }));
  app.use(auth.sessionMiddleware, auth.locals);
  app.use('/admin', auth.requireLogin);
  app.use(auth.csrf, auth.router);

  const load = async (resource: Resource, raw: unknown) => {
    const id = parseId(raw);
    if (!id) throw new NotFoundError();
    const entity = await store.find(resource, id);
    if (!entity) throw new NotFoundError();
    return entity;
  };
  const confirmation = (resource: Resource, id: number, expires: string) =>
    createHmac('sha256', secret).update(`${resource}:${id}:${expires}`).digest('hex');
  const deletePage = (res: Response, resource: Resource, entity: Entity, error = '', status = 200) => {
    const expires = String(Date.now() + 30 * 60 * 1000);
    const blocked = resource === 'ingredients' && Boolean(entity.dishes?.length);
    return res.status(status).render('admin/delete', {
      pageTitle: `Xóa ${labels[resource].singular}`, resource, entity, blocked, error,
      expires, token: confirmation(resource, entity.id, expires),
    });
  };
  const validConfirmation = (resource: Resource, id: number, body: Record<string, unknown>) => {
    if (typeof body.expires !== 'string' || typeof body.token !== 'string' || !/^\d{13}$/.test(body.expires) || !/^[a-f0-9]{64}$/.test(body.token)) return false;
    const expires = Number(body.expires);
    if (expires < Date.now() || expires > Date.now() + 30 * 60 * 1000) return false;
    return timingSafeEqual(Buffer.from(body.token, 'hex'), Buffer.from(confirmation(resource, id, body.expires), 'hex'));
  };
  const renderForm = async (res: Response, resource: Resource, entity: Entity | undefined, values: FormValues, errors: Errors = {}, status = 200) => {
    const [chefs, ingredients] = resource === 'dishes'
      ? await Promise.all([store.allOptions('chefs'), store.allOptions('ingredients')]) : [[], []];
    return res.status(status).render('admin/form', {
      resource, entity, values, errors, chefs, ingredients,
      pageTitle: `${entity ? 'Chỉnh sửa' : 'Thêm'} ${labels[resource].singular}`,
    });
  };

  const renderList = async (req: Request, res: Response, resource: Resource, guest = false) => {
    const state = listState(req.query);
    const facets = resource === 'dishes' ? await store.facets() : { categories: [] };
    let query: ListQuery;
    try {
      if (Object.values(req.query).some(value => typeof value !== 'string')) throw new InputError({form:'Điều kiện truy vấn không hợp lệ.'});
      query = parseListQuery(resource, { ...state, mode: guest ? 'fulltext' : 'advanced', ...(guest ? { fallback: 'fuzzy' } : {}) });
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      return res.status(400).render(guest ? 'dishes/index' : 'admin/index', {
        resource, pageTitle: guest ? 'Thực đơn' : `Quản lý ${labels[resource].singular}`,
        state, categories: facets.categories, result: null, message: '',
        queryError: Object.values(error.errors).join(' '),
      });
    }
    const result = await store.list(resource, query);
    if (result.meta.page !== query.page || (req.query.page !== undefined && state.page !== req.query.page))
      return res.redirect(302, listUrl(req.path, state, { page: String(result.meta.page) }));
    const messages: Record<string, string> = {
      created: `Đã thêm ${labels[resource].singular} thành công.`,
      updated: `Đã cập nhật ${labels[resource].singular} thành công.`,
      deleted: `Đã xóa ${labels[resource].singular} thành công.`,
    };
    return res.render(guest ? 'dishes/index' : 'admin/index', {
      resource, pageTitle: guest ? 'Thực đơn' : `Quản lý ${labels[resource].singular}`,
      result, state, categories: facets.categories, queryError: '',
      message: typeof req.query.status === 'string' ? messages[req.query.status] ?? '' : '',
    });
  };
  app.get('/', (_req, res) => res.redirect('/dishes'));
  app.get('/dishes', (req, res) => renderList(req, res, 'dishes', true));
  app.get('/dishes/:id', async (req, res) => {
    const dish = await load('dishes', req.params.id);
    res.render('dishes/show', { pageTitle: dish.name, dish });
  });
  app.get('/admin', (_req, res) => res.redirect('/admin/dishes'));

  for (const resource of resources) {
    const base = `/admin/${resource}`;
    app.get(base, (req, res) => renderList(req, res, resource));
    app.get(`${base}/new`, async (_req, res) => renderForm(res, resource, undefined, entityValues()));
    app.get(`${base}/:id/edit`, async (req, res) => {
      const entity = await load(resource, req.params.id);
      return renderForm(res, resource, entity, entityValues(entity));
    });
    app.get(`${base}/:id/delete`, async (req, res) => deletePage(res, resource, await load(resource, req.params.id)));
    app.post(base, async (req, res) => {
      const values = formValues(req.body);
      try {
        await store.create(resource, validate(resource, values));
        return res.redirect(303, `${base}?status=created`);
      } catch (error) {
        if (error instanceof InputError) return renderForm(res, resource, undefined, values, error.errors, 400);
        throw error;
      }
    });
    app.patch(`${base}/:id`, async (req, res) => {
      const entity = await load(resource, req.params.id);
      const values = formValues(req.body);
      try {
        await store.update(resource, entity.id, validate(resource, values));
        return res.redirect(303, `${base}?status=updated`);
      } catch (error) {
        if (error instanceof InputError) return renderForm(res, resource, entity, values, error.errors, 400);
        throw error;
      }
    });
    app.delete(`${base}/:id`, async (req, res) => {
      const entity = await load(resource, req.params.id);
      if (!validConfirmation(resource, entity.id, req.body ?? {})) {
        return deletePage(res, resource, entity, 'Vui lòng xác nhận lại thao tác xóa. Phiên xác nhận trước có thể đã hết hạn.', 400);
      }
      try {
        await store.delete(resource, entity.id);
        return res.redirect(303, `${base}?status=deleted`);
      } catch (error) {
        if (error instanceof IngredientInUseError) return deletePage(res, resource, { ...entity, dishes: error.dishes }, 'Chưa thể xóa nguyên liệu đang được sử dụng.', 400);
        throw error;
      }
    });
  }

  app.use((_req, _res, next) => next(new NotFoundError()));
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);
    const status = error instanceof NotFoundError ? 404
      : typeof error === 'object' && error !== null && 'status' in error && [400, 413].includes(Number(error.status)) ? Number(error.status) : 500;
    if (status === 500) (options.logger ?? console).error('Không thể xử lý yêu cầu nhà hàng. Kiểm tra kết nối và cấu hình máy chủ.');
    return res.status(status).render('error', {
      retryUrl: _req.path === '/reset' ? '/forgot'
        : ['/login', '/register', '/activate', '/forgot'].includes(_req.path) ? _req.path
        : _req.path === '/activate/resend' ? '/activate'
        : _req.path === '/logout' ? '/login'
        : _req.method === 'PATCH' ? _req.path + '/edit'
        : _req.method === 'DELETE' ? _req.path + '/delete'
        : _req.method === 'POST' ? _req.path + '/new'
        : _req.originalUrl.startsWith('/') && !_req.originalUrl.startsWith('//') ? _req.originalUrl : '/dishes',
      pageTitle: status === 404 ? 'Không tìm thấy' : 'Không thể xử lý yêu cầu', status,
      heading: status === 404 ? 'Có lẽ bạn đã rẽ nhầm bàn.' : status === 500 ? 'Căn bếp đang nghỉ một chút.' : 'Yêu cầu chưa hợp lệ.',
      message: status === 404 ? 'Trang hoặc dữ liệu bạn tìm không tồn tại. Hãy quay lại để khám phá những món ngon khác.'
        : status === 500 ? 'Chúng tôi chưa thể đọc hoặc lưu dữ liệu. Vui lòng thử lại sau.' : 'Dữ liệu gửi lên không đúng định dạng hoặc vượt quá giới hạn. Vui lòng quay lại và thử lại.',
    });
  });
  return app;
}
