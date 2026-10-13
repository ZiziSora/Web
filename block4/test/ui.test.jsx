import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../src/App.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const seed = Array.from({ length: 52 }, (_, i) => ({ id: i + 1, name: `Student ${i + 1}`, email: `s${i + 1}@example.com` }));
const result = body => ({ ok: true, json: async () => structuredClone(body) });
function fill(name = 'Nguyễn Văn An', email = 'an@example.com') {
  fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
}

test('52 students paginate, submit uses fetch, waits for save, clears form and goes to last page', async () => {
  let resolveSave;
  const fetchMock = vi.fn((url, options) => options.method === 'POST'
    ? new Promise(resolve => { resolveSave = resolve; }) : Promise.resolve(result(seed)));
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByText('52 sinh viên');
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11);
  expect(screen.getByRole('button', { name: 'Trước' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Trang 6' }));
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Sau' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Trước' }));
  expect(screen.getByText(/Trang 5\/6/)).toBeTruthy();
  fill();
  const form = screen.getByRole('button', { name: 'Thêm sinh viên' }).closest('form');
  expect(fireEvent.submit(form)).toBe(false);
  expect(screen.getByRole('button', { name: 'Đang lưu…' }).disabled).toBe(true);
  expect(screen.getByLabelText('Họ và tên').value).toBe('Nguyễn Văn An');
  expect(screen.queryByText('53 sinh viên')).toBeNull();
  fireEvent.submit(form);
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
  resolveSave(result({ id: 53, name: 'Nguyễn Văn An', email: 'an@example.com' }));
  await screen.findByText('Đã thêm sinh viên thành công.');
  expect(screen.getByLabelText('Họ và tên').value).toBe('');
  expect(screen.getByLabelText('Email').value).toBe('');
  expect(screen.getByText(/Trang 6\/6/)).toBeTruthy();
  expect(screen.getByText('Nguyễn Văn An')).toBeTruthy();
  expect(fetchMock.mock.calls.at(-1)[1].headers['Content-Type']).toBe('application/json');
});

test('adding the 61st student creates and selects a new page', async () => {
  const sixty = [...seed, ...Array.from({ length: 8 }, (_, i) => ({ id: 53 + i, name: `Extra ${i}`, email: `extra${i}@example.com` }))];
  vi.stubGlobal('fetch', vi.fn((url, options) => Promise.resolve(result(options.method === 'POST' ? { id: 61, name: 'Nguyễn Văn An', email: 'an@example.com' } : sixty))));
  render(<App />);
  await screen.findByText('60 sinh viên');
  fill();
  fireEvent.submit(screen.getByRole('button', { name: 'Thêm sinh viên' }).closest('form'));
  await screen.findByText(/Trang 7\/7/);
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
});

test('invalid input and server errors preserve input and list', async () => {
  const fetchMock = vi.fn((url, options) => Promise.resolve(options.method === 'POST'
    ? { ok: false, json: async () => ({ code: 'storage_error', message: 'Không thể lưu dữ liệu.' }) } : result(seed)));
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByText('52 sinh viên');
  fill('   ', 'bad');
  fireEvent.submit(screen.getByRole('button', { name: 'Thêm sinh viên' }).closest('form'));
  expect(screen.getByRole('alert').textContent).toMatch(/nhập đầy đủ/);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fill();
  fireEvent.submit(screen.getByRole('button', { name: 'Thêm sinh viên' }).closest('form'));
  await screen.findByText('Không thể lưu dữ liệu.');
  expect(screen.getByLabelText('Email').value).toBe('an@example.com');
  expect(screen.getByText('52 sinh viên')).toBeTruthy();
  expect(screen.queryByText('Đã thêm sinh viên thành công.')).toBeNull();
});

test('failed initial load disables form and retry can show empty state', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Offline')).mockResolvedValueOnce(result([])));
  render(<App />);
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Thêm sinh viên' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await screen.findByText('Chưa có sinh viên. Hãy thêm sinh viên đầu tiên.');
  expect(screen.queryByRole('navigation')).toBeNull();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Thêm sinh viên' }).disabled).toBe(false));
});
