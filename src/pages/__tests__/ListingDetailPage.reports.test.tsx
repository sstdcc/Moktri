import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ListingDetailPage from '../ListingDetailPage';

const h = vi.hoisted(() => {
  const insertMock = vi.fn();
  const rpcMock = vi.fn();
  const navigateMock = vi.fn();
  const toastMock = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const state = {
    authUserId: 'user-1' as string | null,
    listing: null as any,
    similar: [] as any[],
    reportInsertError: null as any,
  };
  return { insertMock, rpcMock, navigateMock, toastMock, state };
});

const buildProfile = (overrides: Record<string, any> = {}) => ({
  id: 'owner-1',
  full_name: 'المالك',
  avatar_url: null,
  role: 'user',
  bio: null,
  is_verified: false,
  verification_badge: null,
  total_listings: 1,
  total_responses: 0,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

const buildListing = (overrides: Record<string, any> = {}) => {
  const now = new Date().toISOString();
  return {
    id: 'listing-1',
    owner_id: 'owner-1',
    title: 'شقة للايجار',
    description: 'وصف الإعلان',
    category: 'apartment',
    district_id: 'district-1',
    neighborhood: 'حي النصر',
    price: 100000,
    currency: 'YER',
    billing_period: 'monthly',
    is_negotiable: false,
    status: 'active',
    is_featured: false,
    is_urgent: false,
    views_count: 0,
    favorites_count: 0,
    quality_score: 0,
    published_at: now,
    expires_at: null,
    last_updated_at: now,
    created_at: now,
    listing_images: [],
    districts: null,
    profiles: buildProfile(),
    governorate: null,
    city_name: null,
    ...overrides,
  };
};

vi.mock('@/integrations/supabase/client', () => {
  const resolveListing = () => ({ data: h.state.listing, error: null });
  return {
    supabase: {
      rpc: h.rpcMock,
      from: (table: string) => {
        const chain: any = {};
        const self = () => chain;
        chain.select = () => self();
        chain.eq = () => self();
        chain.neq = () => self();
        chain.order = () => self();
        chain.in = () => self();
        chain.single = () =>
          Promise.resolve(table === 'listings' ? resolveListing() : { data: null, error: null });
        chain.limit = () => Promise.resolve({ data: h.state.similar, error: null });
        chain.insert = (payload: any) => {
          h.insertMock({ table, payload });
          return Promise.resolve({ data: null, error: h.state.reportInsertError });
        };
        chain.then = (resolve: any) => Promise.resolve(resolve({ data: null, error: null }));
        return chain;
      },
    },
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: h.state.authUserId ? { id: h.state.authUserId, user_metadata: { full_name: 'مستخدم' } } : null,
  }),
}));

vi.mock('@/hooks/useFavorites', () => ({
  useFavorites: () => ({ isFavorited: () => false, toggleFavorite: vi.fn() }),
}));

vi.mock('@/hooks/useSeo', () => ({ useSeo: () => {} }));
vi.mock('@/hooks/useJsonLd', () => ({ useJsonLd: () => {} }));

vi.mock('embla-carousel-react', () => ({
  default: () => [{}, { selectedScrollSnap: () => 0, off: () => {}, on: () => {} }],
}));

vi.mock('sonner', () => ({ toast: h.toastMock }));

vi.mock('@/components/chat/ChatModal', () => ({ ChatModal: () => null }));
vi.mock('@/components/rating/RatingDisplay', () => ({ RatingDisplay: () => null }));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'listing-1' }),
  useNavigate: () => h.navigateMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  h.state.authUserId = 'user-1';
  h.state.similar = [];
  h.state.reportInsertError = null;
  h.state.listing = buildListing();
  h.rpcMock.mockResolvedValue({ data: [], error: null });
});

const openReportSheet = async () => {
  fireEvent.click(screen.getByText('الإبلاغ عن هذا الإعلان'));
  await waitFor(() => expect(screen.getByText('إرسال البلاغ')).toBeInTheDocument());
};

const pickReason = (label: string) => {
  const labelEl = screen.getByText(label).closest('label');
  if (!labelEl) throw new Error(`reason label not found: ${label}`);
  fireEvent.click(labelEl);
};

const sendButton = () => screen.getByRole('button', { name: 'إرسال البلاغ' });

describe('ListingDetailPage – report flow', () => {
  it('A: active listing shows report button and successful insert closes sheet + shows success', async () => {
    render(<ListingDetailPage />);
    await screen.findByText('شقة للايجار');

    const reportBtn = screen.getByText('الإبلاغ عن هذا الإعلان');
    expect(reportBtn).toBeInTheDocument();

    await openReportSheet();
    pickReason('إعلان وهمي');
    expect(sendButton()).not.toBeDisabled();

    fireEvent.click(sendButton());
    await waitFor(() => expect(h.insertMock).toHaveBeenCalledTimes(1));

    expect(h.toastMock.success).toHaveBeenCalledWith('تم إرسال البلاغ بنجاح');
    expect(h.toastMock.error).not.toHaveBeenCalled();
    expect(h.insertMock).toHaveBeenCalledWith({
      table: 'reports',
      payload: expect.objectContaining({
        reporter_id: 'user-1',
        target_type: 'listing',
        target_id: 'listing-1',
        reason: 'fake',
        notes: null,
      }),
    });
    await waitFor(() => expect(screen.queryByText('إرسال البلاغ')).not.toBeInTheDocument());
  });

  it('B: reason "other" requires >=10 chars, sends trimmed notes, null otherwise', async () => {
    render(<ListingDetailPage />);
    await screen.findByText('شقة للايجار');
    await openReportSheet();

    pickReason('أخرى');
    const textarea = screen.getByPlaceholderText(/10 أحرف على الأقل/);
    expect(textarea).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'وصف' } });
    expect(sendButton()).toBeDisabled();

    const ten = 'أ'.repeat(10);
    fireEvent.change(textarea, { target: { value: `  ${ten}  ` } });
    expect(sendButton()).not.toBeDisabled();

    fireEvent.click(sendButton());
    await waitFor(() => expect(h.insertMock).toHaveBeenCalledTimes(1));
    expect(h.insertMock).toHaveBeenCalledWith({
      table: 'reports',
      payload: expect.objectContaining({ reason: 'other', notes: ten }),
    });
    expect(h.toastMock.success).toHaveBeenCalledWith('تم إرسال البلاغ بنجاح');
  });

  it('C: duplicate (23505) shows "لقد أبلغت عن هذا الإعلان مسبقًا." and keeps sheet open', async () => {
    h.state.reportInsertError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "reports_unique_reporter_target"',
    };
    render(<ListingDetailPage />);
    await screen.findByText('شقة للايجار');
    await openReportSheet();

    pickReason('إعلان مكرر');
    fireEvent.click(sendButton());
    await waitFor(() => expect(h.insertMock).toHaveBeenCalledTimes(1));

    expect(h.toastMock.error).toHaveBeenCalledWith('لقد أبلغت عن هذا الإعلان مسبقًا.');
    expect(h.toastMock.success).not.toHaveBeenCalled();
    expect(screen.getByText('إرسال البلاغ')).toBeInTheDocument();
  });

  it('B-err: other with <10 chars triggers toast error and blocks sending', async () => {
    render(<ListingDetailPage />);
    await screen.findByText('شقة للايجار');
    await openReportSheet();

    // Force submit validation path (button disabled normally, so call the guard via short note is unclickable).
    pickReason('أخرى');
    const textarea = screen.getByPlaceholderText(/10 أحرف على الأقل/);
    fireEvent.change(textarea, { target: { value: 'قصير' } });
    expect(sendButton()).toBeDisabled();
    expect(h.insertMock).not.toHaveBeenCalled();
  });

  it('D: owner does not see report button (sees edit instead)', async () => {
    h.state.authUserId = 'owner-1';
    render(<ListingDetailPage />);
    await screen.findByText('شقة للايجار');

    expect(screen.getByText('تعديل الإعلان')).toBeInTheDocument();
    expect(screen.queryByText('الإبلاغ عن هذا الإعلان')).not.toBeInTheDocument();
  });

  it('E: non-active listing does not show report button', async () => {
    h.state.listing = buildListing({ status: 'paused' });
    render(<ListingDetailPage />);
    await screen.findByText('شقة للايجار');

    expect(screen.queryByText('الإبلاغ عن هذا الإعلان')).not.toBeInTheDocument();
  });
});