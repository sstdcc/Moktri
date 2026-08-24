import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  MarkAsRentedDialog,
  canShowMarkRentedAction,
} from '../MarkAsRentedDialog';
import { createNotificationService } from '@/services';

// ---- Mocks -----------------------------------------------------------------

interface MockDbState {
  listingsUpdateCalls: number;
  rentalInsertCalls: number;
  admins: Array<{ id: string }>;
}

type QueryResult = { data: unknown; error: null };

interface QueryChain {
  select: (cols?: string) => QueryChain;
  eq: () => QueryChain;
  in: () => QueryChain;
  order: () => QueryChain;
  limit: () => QueryChain;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
  update: () => QueryChain;
  insert: () => QueryChain;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

const dbState = (): MockDbState =>
  (globalThis as { __mockDbState__?: MockDbState }).__mockDbState__!;

interface MarkRentedArgs {
  p_listing_id: string;
  p_renter_id: string | null;
  p_broker_id: string | null;
  p_external_tenant_name: string | null;
  p_external_tenant_phone: string | null;
}

const markRentedCall = (): MarkRentedArgs | undefined => {
  const call = rpcMock.mock.calls.find((c: unknown[]) => c[0] === 'mark_listing_rented');
  return call ? (call[1] as MarkRentedArgs) : undefined;
};

const rpcMock = vi.hoisted(() => vi.fn());
const createManyMock = vi.hoisted(() => vi.fn());

// STABLE identity across renders: the real AuthContext stores `user` in
// useState (stable reference). Recreating the object per call would change
// the useEffect deps identity every render and cause an infinite effect loop.
const authValue = vi.hoisted(() => ({ user: { id: 'owner-1' } as { id: string } }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
    from: (table: string) => {
      const state = dbState();
      const resolveData = (cols: string): QueryResult => {
        if (table === 'listing_conversations') return { data: [], error: null };
        if (table === 'profiles' && cols.includes('full_name'))
          return { data: [{ id: 'broker-1', full_name: 'الوسيط الأول' }], error: null };
        if (table === 'profiles') return { data: state.admins, error: null };
        return { data: null, error: null };
      };
      const makeChain = (columns = ''): QueryChain => {
        const chain: QueryChain = {
          select: (cols?: string) => makeChain(cols ?? ''),
          eq: () => chain,
          in: () => chain,
          order: () => chain,
          limit: () => chain,
          single: () => Promise.resolve({ data: null, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          update: () => {
            state.listingsUpdateCalls += 1;
            return chain;
          },
          insert: () => {
            state.rentalInsertCalls += 1;
            return chain;
          },
          then: (resolve: (value: QueryResult) => unknown) =>
            Promise.resolve(resolve(resolveData(columns))),
        };
        return chain;
      };
      return makeChain();
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authValue,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/services', () => ({
  createNotificationService: vi.fn(() => ({ createMany: createManyMock })),
}));

import { toast } from 'sonner';

// ---- Helpers ----------------------------------------------------------------

type RpcOutcome =
  | { kind: 'ok'; rental_status?: string; listing_status?: string }
  | { kind: 'error'; message: string };

function setRpcOutcome(outcome: RpcOutcome) {
  rpcMock.mockImplementation(async (_fn: string) => {
    if (_fn === 'find_user_id_by_phone') return { data: 'renter-9', error: null };
    if (outcome.kind === 'error')
      return { data: null, error: { message: outcome.message } };
    return {
      data: { ok: true, rental_id: 'r-1', rental_status: outcome.rental_status ?? 'completed', listing_status: outcome.listing_status ?? 'rented' },
      error: null,
    };
  });
}

function freshState() {
  (globalThis as { __mockDbState__?: MockDbState }).__mockDbState__ = {
    listingsUpdateCalls: 0,
    rentalInsertCalls: 0,
    admins: [],
  };
}

const renderDialog = (props: Partial<Parameters<typeof MarkAsRentedDialog>[0]> = {}) =>
  render(
    <MarkAsRentedDialog
      open
      onOpenChange={vi.fn()}
      listingId="listing-1"
      listingTitle="شقة حي الجامعة"
      {...props}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  freshState();
  createManyMock.mockResolvedValue([]);
});

// ---- UI guard predicate (O / P + lifecycle) ----------------------------------

describe('canShowMarkRentedAction (UI guard)', () => {
  it('O: hides the action while the listing is rented', () => {
    expect(canShowMarkRentedAction('rented')).toBe(false);
  });

  it('P: shows the action again once the listing is re-listed (active)', () => {
    expect(canShowMarkRentedAction('active')).toBe(true);
  });

  it('lifecycle ACTIVE -> RENTED -> ACTIVE keeps the guard consistent', () => {
    // ACTIVE
    expect(canShowMarkRentedAction('active')).toBe(true);
    // MARKED AS RENTED -> RENTED
    expect(canShowMarkRentedAction('rented')).toBe(false);
    // lease ends -> owner re-lists -> ACTIVE again
    expect(canShowMarkRentedAction('active')).toBe(true);
    // marked rented AGAIN -> current state is rented once more
    expect(canShowMarkRentedAction('rented')).toBe(false);
    // non-rented operational states remain actionable
    expect(canShowMarkRentedAction('paused')).toBe(true);
  });

  it('reserved stays hidden (dedicated confirm-delivery flow covers it)', () => {
    expect(canShowMarkRentedAction('reserved')).toBe(false);
    expect(canShowMarkRentedAction(null)).toBe(true);
  });
});

// ---- Dialog submission flows ---------------------------------------------------

describe('MarkAsRentedDialog submission', () => {
  it('A/I/N: internal registered renter — atomic RPC success completes the flow', async () => {
    setRpcOutcome({ kind: 'ok' });
    const onCompleted = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ reservedRenterId: 'renter-7', onCompleted, onOpenChange });

    const submit = await screen.findByRole('button', { name: 'تأكيد الإيجار' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalled();

    // Atomic RPC used with registered-renter payload
    const args = markRentedCall();
    expect(args?.p_listing_id).toBe('listing-1');
    expect(args?.p_renter_id).toBe('renter-7');
    expect(args?.p_external_tenant_name).toBeNull();

    // No direct table writes anymore (single atomic entry point)
    expect(dbState().rentalInsertCalls).toBe(0);
    expect(dbState().listingsUpdateCalls).toBe(0);
  });

  it('B/K: external tenant — payload carries external fields with renter_id=null', async () => {
    setRpcOutcome({ kind: 'ok' });
    const onCompleted = vi.fn();
    renderDialog({ onCompleted });

    fireEvent.click(await screen.findByRole('button', { name: 'تم التأجير من خارج مكتري' }));
    fireEvent.change(screen.getByPlaceholderText('الاسم الكامل'), { target: { value: ' محمد علي ' } });
    fireEvent.change(screen.getByPlaceholderText('+967xxxxxxxxx'), { target: { value: '+967730122233' } });

    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإيجار' }));

    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
    const args = markRentedCall();
    expect(args?.p_renter_id).toBeNull();
    expect(args?.p_external_tenant_name).toBe('محمد علي'); // trimmed
    expect(args?.p_external_tenant_phone).toBe('+967730122233');
    // External tenants have no account and no broker selected → no notifications at all
    expect(createManyMock).not.toHaveBeenCalled();
  });

  it('C: RPC blocks a currently-rented listing — failure surfaced, nothing completed', async () => {
    setRpcOutcome({ kind: 'error', message: 'الإعلان مؤجر بالفعل' });
    const onCompleted = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ reservedRenterId: 'renter-7', onCompleted, onOpenChange });

    const submit = await screen.findByRole('button', { name: 'تأكيد الإيجار' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('الإعلان مؤجر بالفعل'));
    expect(onCompleted).not.toHaveBeenCalled();          // reminder notification KEPT (M)
    expect(onOpenChange).not.toHaveBeenCalledWith(false); // dialog stays open
    expect(toast.success).not.toHaveBeenCalled();          // no false success (Problem 3)
  });

  it('G/H: RPC failure rolls back everything — client never performs partial writes', async () => {
    setRpcOutcome({ kind: 'error', message: 'تعذر إكمال العملية' });
    const onCompleted = vi.fn();
    renderDialog({ reservedRenterId: 'renter-7', onCompleted });

    const submit = await screen.findByRole('button', { name: 'تأكيد الإيجار' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onCompleted).not.toHaveBeenCalled();
    expect(dbState().rentalInsertCalls).toBe(0);
    expect(dbState().listingsUpdateCalls).toBe(0);
  });

  it('E: rapid double click creates exactly ONE rental request', async () => {
    let resolveRpc!: (v: unknown) => void;
    rpcMock.mockImplementation((_fn: string) =>
      _fn === 'find_user_id_by_phone'
        ? Promise.resolve({ data: 'renter-9', error: null })
        : new Promise((res) => { resolveRpc = res; }),
    );
    const onCompleted = vi.fn();
    renderDialog({ reservedRenterId: 'renter-7', onCompleted });

    const submit = await screen.findByRole('button', { name: 'تأكيد الإيجار' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);
    fireEvent.click(submit);

    resolveRpc({ data: { ok: true, rental_status: 'completed', listing_status: 'rented' }, error: null });
    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));

    const calls = rpcMock.mock.calls.filter((c: unknown[]) => c[0] === 'mark_listing_rented');
    expect(calls.length).toBe(1);
  });

  it('pending-review branch (private offer): admins notified, listing kept reserved', async () => {
    dbState().admins = [{ id: 'admin-1' }, { id: 'mod-1' }];
    setRpcOutcome({ kind: 'ok', rental_status: 'pending_review', listing_status: 'reserved' });
    const onCompleted = vi.fn();
    renderDialog({ reservedRenterId: 'renter-7', onCompleted });

    const submit = await screen.findByRole('button', { name: 'تأكيد الإيجار' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('تم رفع الإيجار للمراجعة', expect.anything()));
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(createManyMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'rental_pending_review',
          recipientId: 'admin-1',
        }),
      ]),
    );
  });
});
