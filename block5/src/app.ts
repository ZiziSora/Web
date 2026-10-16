import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import methodOverride from 'method-override';
import {
  resources, labels, money, parseId, formValues, entityValues, validate,
  InputError, NotFoundError, IngredientInUseError,
  type RestaurantStore, type Resource, type FormValues, type Errors, type Entity,
} from './domain.js';

export function createApp(store: RestaurantStore, options: { root?: string; logger?: { error(message: string): void } } = {}) {
  const app = express();
  const root = options.root ?? fileURLToPath(new URL('../', import.meta.url));
  const secret = randomBytes(32);
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(root, 'views'));
  app.locals = { ...app.locals, labels, money };
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; img-src 'self' data:; script-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    res.locals = { ...res.locals, admin: req.path.startsWith('/admin'), resource: '', pageTitle: 'The Table', q: '' };
    next();
  });
  app.use(express.static(path.join(root, 'public')));
  app.use(express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 500 }));
  app.use(methodOverride(req => {
    if (req.method === 'POST' && ['PATCH', 'DELETE'].includes(req.body?._method)) return req.body._method;
  }, { methods: ['POST'] }));

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
      ? await Promise.all([store.list('chefs'), store.list('ingredients')]) : [[], []];
    return res.status(status).render('admin/form', {
      resource, entity, values, errors, chefs, ingredients,
      pageTitle: `${entity ? 'Chỉnh sửa' : 'Thêm'} ${labels[resource].singular}`,
    });
  };

  app.get('/', (_req, res) => res.redirect('/dishes'));
  app.get('/dishes', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const dishes = await store.list('dishes', q);
    res.render('dishes/index', { pageTitle: 'Thực đơn', dishes, q });
  });
  app.get('/dishes/:id', async (req, res) => {
    const dish = await load('dishes', req.params.id);
    res.render('dishes/show', { pageTitle: dish.name, dish });
  });
  app.get('/admin', (_req, res) => res.redirect('/admin/dishes'));

  for (const resource of resources) {
    const base = `/admin/${resource}`;
    app.get(base, async (req, res) => {
      const entities = await store.list(resource);
      const messages: Record<string, string> = {
        created: `Đã thêm ${labels[resource].singular} thành công.`,
        updated: `Đã cập nhật ${labels[resource].singular} thành công.`,
        deleted: `Đã xóa ${labels[resource].singular} thành công.`,
      };
      res.render('admin/index', {
        pageTitle: `Quản lý ${labels[resource].singular}`, resource, entities,
        message: typeof req.query.status === 'string' ? messages[req.query.status] ?? '' : '',
      });
    });
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
      pageTitle: status === 404 ? 'Không tìm thấy' : 'Không thể xử lý yêu cầu', status,
      heading: status === 404 ? 'Có lẽ bạn đã rẽ nhầm bàn.' : status === 500 ? 'Căn bếp đang nghỉ một chút.' : 'Yêu cầu chưa hợp lệ.',
      message: status === 404 ? 'Trang hoặc dữ liệu bạn tìm không tồn tại. Hãy quay lại để khám phá những món ngon khác.'
        : status === 500 ? 'Chúng tôi chưa thể đọc hoặc lưu dữ liệu. Vui lòng thử lại sau.' : 'Dữ liệu gửi lên không đúng định dạng hoặc vượt quá giới hạn. Vui lòng quay lại và thử lại.',
    });
  });
  return app;
}
