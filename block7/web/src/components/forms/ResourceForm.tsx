import { X, LoaderCircle, Save, Plus } from 'lucide-react';
import { useActive } from '../../hooks/useActive';
import React,{ useEffect,useRef,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { api,ApiError,labels,type Entity,type Resource } from '../../api';
import { formConfig } from '../../config/form';
import { type Values } from '../../types/form';
import { FormField } from './FormField';
import { RelationField } from './RelationField';

export function Form({ resource: r, entity, chefs, ingredients }: { resource: Resource; entity?: Entity; chefs: Entity[]; ingredients: Entity[] }) {
  const navigate = useNavigate();
  const active = useActive();
  const [values, set] = useState<Values>({ name: entity?.name ?? '', description: entity?.description ?? '', price: entity?.price ?? '', category: entity?.category ?? '', available: String(entity?.available ?? true), specialty: entity?.specialty ?? '', unit: entity?.unit ?? '', chefIds: entity?.chefs?.map(c => c.id) ?? [], ingredientIds: entity?.ingredients?.map(c => c.id) ?? [] });
  const [error, setError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (error) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')?.focus(); }, [error]);
  const { fields, titles, placeholders } = formConfig(r);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try {
      const body = Object.fromEntries(fields.map(k => [k, k === 'available' ? values[k] === 'true' : values[k]]));
      if (r === 'dishes') Object.assign(body, { chefIds: values.chefIds, ingredientIds: values.ingredientIds });
      await api('/' + r + (entity ? '/' + entity.id : ''), { method: entity ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      if (!active.current) return;
      navigate('/admin/' + r, { state: { message: 'Đã lưu ' + labels[r] + ' thành công.' } });
    } catch (e) { if (active.current) setError(e as ApiError); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  return <form ref={formRef} className="edit-form" onSubmit={submit} noValidate aria-busy={busy}>
    {error && <div className="notice error" role="alert" tabIndex={-1}>{error.fields.form ?? error.message} Thông tin bạn đã nhập vẫn được giữ lại.{error.code === 'NOT_FOUND' && <p><Link to={'/admin/' + r}>Về danh sách {labels[r]}</Link></p>}</div>}
    <fieldset className="form-controls" disabled={busy}><legend className="sr-only">Thông tin {labels[r]}</legend><div className={'form-layout ' + (r !== 'dishes' ? 'compact-form' : '')}><div className="form-panel"><div className="panel-heading"><p>Thông tin cơ bản <span className="muted">· Dấu * là bắt buộc</span></p></div>
      {fields.map(k => <FormField key={k} k={k} title={titles[k]} placeholder={placeholders[k]} value={String(values[k])} error={error?.fields[k]} onChange={value=>set({...values,[k]:value})} />)}
    </div>{r === 'dishes' && <div className="form-panel relation-panel">{[{ key: 'chefIds', title: 'Đầu bếp biết nấu món này', items: chefs, resource: 'chefs' }, { key: 'ingredientIds', title: 'Nguyên liệu của món', items: ingredients, resource: 'ingredients' }].map(g => <RelationField key={g.key} g={g} selected={values[g.key] as number[]} error={error?.fields[g.key]} onChange={ids=>set({...values,[g.key]:ids})} />)}</div>}</div>
    <div className="form-actions"><Link className="button secondary" to={'/admin/' + r}><X aria-hidden="true" focusable="false" /> Hủy bỏ</Link><button type="submit" className="button" disabled={busy || error?.code === 'NOT_FOUND'}>{busy ? <LoaderCircle className="icon-spin" aria-hidden="true" focusable="false" /> : entity ? <Save aria-hidden="true" focusable="false" /> : <Plus aria-hidden="true" focusable="false" />}{busy ? 'Đang lưu…' : entity ? 'Lưu thay đổi' : 'Thêm ' + labels[r]}</button></div></fieldset>
  </form>;
}
