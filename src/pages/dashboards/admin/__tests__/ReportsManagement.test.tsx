import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportsManagement from '../ReportsManagement';

const h = vi.hoisted(() => {
  const toastMock = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const createMock = vi.fn();
  const state = {
    reports: [] as any[],
    reportUpdateError: null as any,
    listingsUpdateError: null as any,
    profilesUpdateError: null as any,
    reportUpdateCalls: [] as any[],
    listingsUpdateCalls: [] as any[],
    profilesUpdateCalls: [] as any[],
    targetListing: null as any,
    listingRows: [] as any[],
    countRows: [] as any[],
  };
  return { toastMock, createMock, state };
});

const buildReport = (overrides: Record<string, any> = {}) => ({
  id: 'report-1',
  reporter_id: 'reporter-1',
  target_type: 'listing',
  target_id: 'listing-1',
  reason: 'fake',
  status: 'pending',
  notes: null,
  resolved_by: null,
  created_at: '2026-01-01T00:00:00Z',
  reporter: { full_name: 'المبلّغ' },
  resolver: null,
  ...overrides,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const chain: any = {};
      let countQuery = false;
      const self = () => chain;
      chain.select = (cols?: string) => {
        if (table === 'reports' && typeof cols === 'string' && cols.includes('target_id')) countQuery = true;
        return self();
      };
      chain.eq = () => self();
      chain.neq = () => self();
      chain.order = () => self();
      chain.in = () => self();
      chain.range = () => Promise.resolve({ data: h.state.reports, error: null });
      chain.single = () =>
        Promise.resolve(table === 'listings' ? { data: h.state.targetListing, error: null } : { data: null, error: null });
      chain.update = (payload: any) => {
        chain.updateCalled = true;
        if (table === 'reports') h.state.reportUpdateCalls.push(payload);
        if (table === 'listings') h.state.listingsUpdateCalls.push(payload);
        if (table === 'profiles') h.state.profilesUpdateCalls.push(payload);
        return self();
      };
      chain.then = (resolve: any) => {
        const error =
          table === 'reports'
            ? h.state.reportUpdateError
            : table === 'listings'
              ? h.state.listingsUpdateError
              : table === 'profiles'
                ? h.state.profilesUpdateError
                : null;
        const data = table === 'listings' && !chain.updateCalled ? h.state.listingRows : countQuery ? h.state.countRows : null;
        return Promise.resolve(resolve({ data, error }));
      };
      return chain;
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1' } }),
}));

vi.mock('sonner', () => ({ toast: h.toastMock }));

vi.mock('@/services', () => ({
  createNotificationService: () => ({
    create: h.createMock,
  }),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: (props: any) => props.children,
  DropdownMenuTrigger: (props: any) => props.children,
  DropdownMenuContent: (props: any) => props.children,
  DropdownMenuItem: (props: any) => <button onClick={props.onClick}>{props.children}</button>,
  DropdownMenuLabel: (props: any) => props.children,
  DropdownMenuSeparator: () => null,
  DropdownMenuGroup: (props: any) => props.children,
}));

beforeEach(() => {
  vi.clearAllMocks();
  h.state.reports = [buildReport()];
  h.state.reportUpdateError = null;
  h.state.listingsUpdateError = null;
  h.state.profilesUpdateError = null;
  h.state.reportUpdateCalls = [];
  h.state.listingsUpdateCalls = [];
  h.state.profilesUpdateCalls = [];
  h.state.targetListing = { id: 'listing-1', owner_id: 'owner-1', title: 'شقة للايجار' };
  h.state.listingRows = [
    {
      id: 'listing-1',
      title: 'شقة للايجار',
      price: 150000,
      status: 'active',
      profiles: { full_name: 'المالك فلان' },
      listing_images: [{ id: 'img-1', url: 'http://img/1', is_primary: true, sort_order: 1 }],
    },
  ];
  h.state.countRows = [
    { target_id: 'listing-1', status: 'resolved', reason: 'spam' },
    { target_id: 'listing-1', status: 'pending', reason: 'fake' },
  ];
  h.createMock.mockResolvedValue({ data: null, error: null });
});

const renderPage = async () => {
  render(
    <MemoryRouter>
      <ReportsManagement />
    </MemoryRouter>,
  );
  await screen.findByText('المبلّغ');
};

describe('ReportsManagement – admin workflow', () => {
  it('G: resolve updates status to resolved and shows success', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'حل البلاغ' }));
    await waitFor(() => expect(h.toastMock.success).toHaveBeenCalledWith('تم حل البلاغ'));
    expect(h.state.reportUpdateCalls).toEqual([
      expect.objectContaining({ status: 'resolved', resolved_by: 'admin-1' }),
    ]);
  });

  it('G: dismiss updates status to dismissed and shows success', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'رفض البلاغ' }));
    await waitFor(() => expect(h.toastMock.success).toHaveBeenCalledWith('تم رفض البلاغ'));
    expect(h.state.reportUpdateCalls).toEqual([
      expect.objectContaining({ status: 'dismissed', resolved_by: 'admin-1' }),
    ]);
  });

  it('G: warnUser sends warning, resolves the report and shows success', async () => {
    h.state.reports = [buildReport({ id: 'report-1', target_type: 'user', target_id: 'user-2' })];
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'تحذير المستخدم' }));
    await waitFor(() => expect(h.toastMock.success).toHaveBeenCalledWith('تم إرسال التحذير وإنهاء البلاغ'));
    expect(h.createMock).toHaveBeenCalledWith('system', 'user-2', expect.objectContaining({ titleAr: 'تحذير من الإدارة' }));
    expect(h.state.reportUpdateCalls).toEqual([
      expect.objectContaining({ status: 'resolved', resolved_by: 'admin-1' }),
    ]);
    expect(h.toastMock.error).not.toHaveBeenCalled();
  });

  it('G: listing report card shows listing meta, owner, price, status and aggregated counts', async () => {
    await renderPage();

    expect(screen.getByText('شقة للايجار')).toBeInTheDocument();
    expect(screen.getByText(/المالك: المالك فلان/)).toBeInTheDocument();
    expect(screen.getByText('150,000 ريال')).toBeInTheDocument();
    expect(screen.getByText('نشط')).toBeInTheDocument();
    expect(screen.getByText('بلاغات على هذا الإعلان: 2')).toBeInTheDocument();
    expect(screen.getByText('سبام · محلول')).toBeInTheDocument();
    expect(screen.getByText('محتوى وهمي · معلق')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'عرض المُبلَّغ عنه' })).toBeInTheDocument();
    expect(h.state.listingsUpdateCalls).toHaveLength(0);
  });

  it('G: report with notes shows the reporter description', async () => {
    h.state.reports = [buildReport({ notes: 'إعلان مخالف للتعليمات' })];
    await renderPage();

    expect(screen.getByText(/إعلان مخالف للتعليمات/)).toBeInTheDocument();
  });

  it('G: remove listing requires confirmation, then sets listing rejected and resolves report', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'إزالة الإعلان' }));

    expect(screen.getByText('تأكيد إزالة الإعلان')).toBeInTheDocument();
    expect(h.state.reportUpdateCalls).toHaveLength(0);
    expect(h.state.listingsUpdateCalls).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإزالة' }));
    await waitFor(() => expect(h.toastMock.success).toHaveBeenCalledWith('تمت إزالة الإعلان وحل البلاغ'));

    expect(h.state.listingsUpdateCalls).toEqual([{ status: 'rejected' }]);
    expect(h.state.reportUpdateCalls).toEqual([
      expect.objectContaining({ status: 'resolved', resolved_by: 'admin-1' }),
    ]);
  });

  it('G: cancel dialog does nothing', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'إزالة الإعلان' }));
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(h.state.reportUpdateCalls).toHaveLength(0);
    expect(h.state.listingsUpdateCalls).toHaveLength(0);
  });

  it('G: suspend account requires confirmation, then disables profile and resolves report', async () => {
    h.state.reports = [buildReport({ id: 'report-1', target_type: 'user', target_id: 'user-2' })];
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'تعليق الحساب' }));

    expect(screen.getByText('تأكيد تعليق الحساب')).toBeInTheDocument();
    expect(h.state.profilesUpdateCalls).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'تأكيد التعليق' }));
    await waitFor(() => expect(h.toastMock.success).toHaveBeenCalledWith('تم تعليق الحساب وحل البلاغ'));

    expect(h.state.profilesUpdateCalls).toEqual([{ is_active: false }]);
    expect(h.state.reportUpdateCalls).toEqual([
      expect.objectContaining({ status: 'resolved', resolved_by: 'admin-1' }),
    ]);
  });

  it('G: failed update shows error and no false success', async () => {
    h.state.reportUpdateError = { message: 'update failed' };
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'حل البلاغ' }));
    await waitFor(() => expect(h.toastMock.error).toHaveBeenCalledWith('فشل حل البلاغ، حاول مرة أخرى'));
    expect(h.toastMock.success).not.toHaveBeenCalled();
  });

  it('G: failed listing removal shows error and no false success', async () => {
    h.state.listingsUpdateError = { message: 'boom' };
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'إزالة الإعلان' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإزالة' }));
    await waitFor(() => expect(h.toastMock.error).toHaveBeenCalledWith('فشل إزالة الإعلان'));
    expect(h.toastMock.success).not.toHaveBeenCalled();
  });
});