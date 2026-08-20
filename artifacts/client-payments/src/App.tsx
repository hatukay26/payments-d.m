import { type ChangeEvent, type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleAlert,
  FileText,
  LayoutDashboard,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  getGetCustomerQueryKey,
  getGetDashboardSummaryQueryKey,
  getListCustomersQueryKey,
  useCreateCustomer,
  useCreatePayment,
  useDeleteCustomer,
  useGetCustomer,
  useGetDashboardSummary,
  useListCustomers,
  useUpdateCustomer,
} from '@workspace/api-client-react';

const queryClient = new QueryClient();
const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' });

type Customer = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  totalPaid: number;
  paymentCount: number;
  createdAt: string;
};

type CustomerDetails = Customer & { payments: Payment[] };
type Payment = {
  id: number;
  customerId: number;
  amount: number;
  reason: string;
  paidAt: string;
  notes?: string | null;
  createdAt: string;
};
type RecentPayment = Payment & { customerName: string };
type DashboardSummary = {
  totalRevenue: number;
  customerCount: number;
  paymentCount: number;
  recentPayments: RecentPayment[];
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

function formatShortDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : shortDate.format(date);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function cn(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ');
}

function ToastMessage({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[60] flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm font-semibold text-[hsl(var(--foreground))] shadow-xl appear" dir="rtl">
      <span className="flex size-7 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Check size={15} /></span>
      {message}
      <button type="button" data-testid="button-close-toast" onClick={onClose} className="mr-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"><X size={15} /></button>
    </div>
  );
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(187_33%_21%/0.42)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" dir="rtl">
      <div className="w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl appear">
        <div className="flex items-start justify-between border-b border-[hsl(var(--border))] px-6 py-5">
          <div>
            <p className="mb-1 text-xs font-bold tracking-[0.12em] text-[hsl(var(--primary))]">{eyebrow}</p>
            <h2 className="text-2xl font-extrabold text-[hsl(var(--foreground))]">{title}</h2>
          </div>
          <button type="button" data-testid="button-close-modal" onClick={onClose} className="rounded-xl p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"><X size={19} /></button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = 'text', placeholder, required = false, multiline = false }: { label: string; name: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean; multiline?: boolean }) {
  const shared = {
    id: name,
    name,
    value,
    required,
    placeholder,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    className: 'mt-2 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 py-3 text-[15px] text-[hsl(var(--foreground))] outline-none transition-all placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--accent))] focus:ring-4 focus:ring-[hsl(var(--accent)/0.18)]',
  };
  return (
    <label htmlFor={name} className="block text-sm font-bold text-[hsl(var(--foreground))]">
      {label}{required && <span className="mr-1 text-[hsl(var(--destructive))]">*</span>}
      {multiline ? <textarea {...shared} rows={3} /> : <input {...shared} type={type} />}
    </label>
  );
}

function CustomerForm({ customer, onClose, onSaved, notify }: { customer?: Customer; onClose: () => void; onSaved: (customer: Customer) => void; notify: (message: string) => void }) {
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const pending = createCustomer.isPending || updateCustomer.isPending;
  const isEdit = Boolean(customer);

  function submit(event: FormEvent) {
    event.preventDefault();
    const data = { name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, notes: notes.trim() || undefined };
    if (!data.name) return;
    if (customer) {
      updateCustomer.mutate({ id: customer.id, data }, {
        onSuccess: (updated) => { onSaved(updated as Customer); notify('פרטי הלקוח עודכנו'); onClose(); },
      });
    } else {
      createCustomer.mutate({ data }, {
        onSuccess: (created) => { onSaved(created as Customer); notify('הלקוח נוסף בהצלחה'); onClose(); },
      });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="שם הלקוח" name="customer-name" value={name} onChange={setName} placeholder="לדוגמה: יעל כהן" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="טלפון" name="customer-phone" value={phone} onChange={setPhone} type="tel" placeholder="050-0000000" />
        <Field label="אימייל" name="customer-email" value={email} onChange={setEmail} type="email" placeholder="name@email.com" />
      </div>
      <Field label="הערה אישית" name="customer-notes" value={notes} onChange={setNotes} placeholder="כל פרט שיעזור לך לזכור" multiline />
      {(createCustomer.isError || updateCustomer.isError) && <p data-testid="status-customer-error" className="rounded-xl bg-[hsl(var(--destructive)/0.08)] px-3 py-2.5 text-sm font-semibold text-[hsl(var(--destructive))]">שמירת הלקוח לא הצליחה. בדקו את הפרטים ונסו שוב.</p>}
      <div className="flex items-center justify-start gap-3 pt-3">
        <button type="submit" data-testid="button-save-customer" disabled={pending} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-extrabold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
          {pending ? 'שומר…' : isEdit ? 'שמירת שינויים' : 'הוספת לקוח'}
        </button>
        <button type="button" data-testid="button-cancel-customer" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">ביטול</button>
      </div>
    </form>
  );
}

function PaymentForm({ customerId, onClose, onSaved, notify }: { customerId: number; onClose: () => void; onSaved: () => void; notify: (message: string) => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const createPayment = useCreatePayment();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!amount || Number(amount) <= 0 || !reason.trim()) return;
    createPayment.mutate({ data: { customerId, amount: Number(amount), reason: reason.trim(), paidAt, notes: notes.trim() || undefined } }, {
      onSuccess: () => { notify('התשלום נרשם בהצלחה'); onSaved(); onClose(); },
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="סכום" name="payment-amount" value={amount} onChange={setAmount} type="number" placeholder="0" required />
        <Field label="תאריך תשלום" name="payment-date" value={paidAt} onChange={setPaidAt} type="date" required />
      </div>
      <Field label="עבור מה התשלום?" name="payment-reason" value={reason} onChange={setReason} placeholder="לדוגמה: חשבונית 1042" required />
      <Field label="הערה (לא חובה)" name="payment-notes" value={notes} onChange={setNotes} placeholder="למשל: העברה בנקאית" multiline />
      {createPayment.isError && <p data-testid="status-payment-error" className="rounded-xl bg-[hsl(var(--destructive)/0.08)] px-3 py-2.5 text-sm font-semibold text-[hsl(var(--destructive))]">רישום התשלום לא הצליח. בדקו את הפרטים ונסו שוב.</p>}
      <div className="flex items-center justify-start gap-3 pt-3">
        <button type="submit" data-testid="button-save-payment" disabled={createPayment.isPending} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-extrabold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
          {createPayment.isPending ? 'רושם…' : 'רישום תשלום'}
        </button>
        <button type="button" data-testid="button-cancel-payment" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">ביטול</button>
      </div>
    </form>
  );
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 right-0 z-20 hidden w-[248px] flex-col bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))] lg:flex">
      <Link href="/" data-testid="link-brand" className="mb-14 flex items-center gap-3 px-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><WalletCards size={21} /></span>
        <span><strong className="block text-[17px] leading-none">רשומת תשלומים</strong><small className="mt-1 block text-xs text-[hsl(var(--sidebar-foreground)/0.58)]">העסק שלך, מסודר</small></span>
      </Link>
      <nav className="space-y-1">
        <Link href="/" data-testid="link-dashboard" className="flex items-center gap-3 rounded-xl bg-[hsl(var(--sidebar-accent))] px-3 py-3 text-sm font-bold text-[hsl(var(--sidebar-accent-foreground))]">
          <LayoutDashboard size={18} /> לוח בקרה
        </Link>
      </nav>
      <div className="mt-auto rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/0.7)] p-4">
        <div className="mb-3 flex items-center gap-2 text-[hsl(var(--sidebar-primary))]"><Check size={16} /><span className="text-xs font-bold">הכול במקום אחד</span></div>
        <p className="text-xs leading-5 text-[hsl(var(--sidebar-foreground)/0.68)]">רישום קטן עכשיו חוסך חיפוש גדול אחר כך.</p>
      </div>
    </aside>
  );
}

function MobileHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/0.92)] px-5 py-4 backdrop-blur lg:hidden">
      <Link href="/" data-testid="link-mobile-brand" className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><WalletCards size={18} /></span>
        <strong className="text-base">רשומת תשלומים</strong>
      </Link>
      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">לוח בקרה</span>
    </header>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--background))]">
      <Sidebar />
      <div className="lg:mr-[248px]">
        <MobileHeader />
        {children}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, accent }: { icon: typeof WalletCards; label: string; value: string; detail: string; accent: string }) {
  return (
    <div className="soft-card rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-transform duration-200 hover:-translate-y-1">
      <div className="mb-5 flex items-start justify-between">
        <span className={cn('flex size-10 items-center justify-center rounded-xl', accent)}><Icon size={19} /></span>
        <MoreHorizontal size={18} className="text-[hsl(var(--muted-foreground)/0.55)]" />
      </div>
      <p className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="mt-1 text-[2rem] font-extrabold leading-tight tracking-tight text-[hsl(var(--foreground))]">{value}</p>
      <p className="mt-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">{detail}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-44 rounded-2xl shimmer" />)}</div>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"><div className="h-[420px] rounded-2xl shimmer" /><div className="h-[420px] rounded-2xl shimmer" /></div>
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))]"><CircleAlert size={23} /></span>
      <h2 className="font-extrabold">לא הצלחנו לטעון את הנתונים</h2>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">בדוק את החיבור ונסה שוב.</p>
      <button type="button" data-testid="button-retry-dashboard" onClick={onRetry} className="mt-5 rounded-xl bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]">ניסיון נוסף</button>
    </div>
  );
}

function CustomerList({ customers, search, onSearch, onAdd }: { customers: Customer[]; search: string; onSearch: (value: string) => void; onAdd: () => void }) {
  return (
    <section className="soft-card overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex flex-col gap-4 border-b border-[hsl(var(--border))] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-extrabold">הלקוחות שלך</h2><p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">כל האנשים והעסקים שאת.ה עובד.ת איתם</p></div>
        <div className="flex gap-2">
          <label className="relative block flex-1 sm:w-56">
            <Search size={17} className="pointer-events-none absolute right-3 top-3.5 text-[hsl(var(--muted-foreground))]" />
            <input type="search" data-testid="input-search-customers" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="חיפוש לקוח..." className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] py-2.5 pr-10 pl-3 text-sm outline-none transition-all focus:border-[hsl(var(--accent))] focus:ring-4 focus:ring-[hsl(var(--accent)/0.18)]" />
          </label>
          <button type="button" data-testid="button-add-customer" onClick={onAdd} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-sm font-extrabold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5"><Plus size={17} /> <span className="hidden sm:inline">לקוח חדש</span></button>
        </div>
      </div>
      {customers.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><UsersRound size={25} /></span>
          <h3 className="font-extrabold">{search ? 'לא נמצאו תוצאות' : 'זה הזמן להוסיף את הלקוח הראשון'}</h3>
          <p className="mt-1 max-w-xs text-sm leading-6 text-[hsl(var(--muted-foreground))]">{search ? 'נסו לחפש בשם אחר או בדקו את האיות.' : 'שמרו את הפרטים במקום אחד, כדי שכל תשלום ימצא את הבית שלו.'}</p>
          {!search && <button type="button" data-testid="button-add-first-customer" onClick={onAdd} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-bold hover:bg-[hsl(var(--muted))]"><Plus size={16} /> הוספת לקוח</button>}
        </div>
      ) : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {customers.map((customer) => (
            <Link key={customer.id} href={`/customers/${customer.id}`} data-testid={`link-customer-${customer.id}`} className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[hsl(var(--secondary)/0.45)]">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent)/0.32)] text-sm font-extrabold text-[hsl(var(--primary))]">{initials(customer.name)}</span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-[15px]">{customer.name}</strong><span className="mt-0.5 block truncate text-xs text-[hsl(var(--muted-foreground))]">{customer.phone || customer.email || 'אין פרטי קשר'}</span></span>
              <span className="hidden text-left sm:block"><strong className="block text-sm">{money.format(customer.totalPaid)}</strong><span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">{customer.paymentCount} תשלומים</span></span>
              <ChevronLeft size={18} className="text-[hsl(var(--muted-foreground)/0.5)] transition-transform group-hover:-translate-x-1" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentActivity({ payments }: { payments: RecentPayment[] }) {
  return (
    <section className="soft-card rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-5"><div><h2 className="text-lg font-extrabold">תשלומים אחרונים</h2><p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">מה נכנס לאחרונה</p></div><Banknote size={21} className="text-[hsl(var(--primary))]" /></div>
      {payments.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center text-sm text-[hsl(var(--muted-foreground))]"><CalendarDays size={28} className="mb-3 text-[hsl(var(--accent-foreground))]" /><p>עדיין אין תשלומים להצגה.</p></div> : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {payments.map((payment) => <Link key={payment.id} href={`/customers/${payment.customerId}`} data-testid={`link-recent-payment-${payment.id}`} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[hsl(var(--secondary)/0.45)]">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Banknote size={18} /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{payment.customerName}</strong><span className="mt-0.5 block truncate text-xs text-[hsl(var(--muted-foreground))]">{payment.reason} · {formatShortDate(payment.paidAt)}</span></span>
            <strong className="text-sm text-[hsl(var(--primary))]">{money.format(payment.amount)}</strong>
          </Link>)}
        </div>
      )}
    </section>
  );
}

function Dashboard({ notify }: { notify: (message: string) => void }) {
  const [search, setSearch] = useState('');
  const [customerModal, setCustomerModal] = useState(false);
  const params = useMemo(() => search.trim() ? { search: search.trim() } : undefined, [search]);
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const customersQuery = useListCustomers(params, { query: { queryKey: getListCustomersQueryKey(params) } });
  const queryClient = useQueryClient();

  function refresh() {
    summaryQuery.refetch();
    customersQuery.refetch();
  }

  return (
    <main className="workspace-grid min-h-[calc(100dvh-73px)] px-4 py-7 sm:px-6 lg:min-h-[100dvh] lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="appear mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-2 text-sm font-bold text-[hsl(var(--primary))]">יום טוב, איזה כיף לראות אותך</p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">הכסף שלך, <span className="text-[hsl(var(--primary))]">ברור יותר.</span></h1><p className="mt-2 text-[15px] text-[hsl(var(--muted-foreground))]">תמונה קטנה של העסק שלך — כדי שתמיד תדע.י איפה הדברים עומדים.</p></div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))]"><span className="size-2 rounded-full bg-[hsl(var(--chart-4))]" /> הנתונים שלך מעודכנים</div>
        </div>
        {summaryQuery.isLoading || customersQuery.isLoading ? <DashboardSkeleton /> : summaryQuery.isError || customersQuery.isError ? <DashboardError onRetry={refresh} /> : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="appear-delay-1 appear"><StatCard icon={WalletCards} label="סך ההכנסות" value={money.format((summaryQuery.data as DashboardSummary | undefined)?.totalRevenue ?? 0)} detail="סך כל התשלומים שנרשמו" accent="bg-[hsl(var(--accent)/0.38)] text-[hsl(var(--primary))]" /></div>
              <div className="appear-delay-2 appear"><StatCard icon={UsersRound} label="לקוחות" value={String((summaryQuery.data as DashboardSummary | undefined)?.customerCount ?? 0)} detail="לקוחות ברשומה שלך" accent="bg-[hsl(var(--secondary))] text-[hsl(var(--chart-2))]" /></div>
              <div className="appear-delay-3 appear"><StatCard icon={FileText} label="תשלומים שנרשמו" value={String((summaryQuery.data as DashboardSummary | undefined)?.paymentCount ?? 0)} detail="כל הרשומות, מההתחלה" accent="bg-[hsl(var(--chart-3)/0.18)] text-[hsl(var(--chart-3))]" /></div>
            </div>
            <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
              <div className="appear"><CustomerList customers={(customersQuery.data as Customer[] | undefined) ?? []} search={search} onSearch={setSearch} onAdd={() => setCustomerModal(true)} /></div>
              <div className="appear appear-delay-1"><RecentActivity payments={(summaryQuery.data as DashboardSummary | undefined)?.recentPayments ?? []} /></div>
            </div>
          </div>
        )}
      </div>
      {customerModal && <Modal title="לקוח חדש" eyebrow="הוספה מהירה" onClose={() => setCustomerModal(false)}><CustomerForm onClose={() => setCustomerModal(false)} onSaved={() => { queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); }} notify={notify} /></Modal>}
    </main>
  );
}

function CustomerDetail({ notify }: { notify: (message: string) => void }) {
  const params = useParams<{ id: string }>();
  const customerId = Number(params.id);
  const [, setLocation] = useLocation();
  const [editModal, setEditModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const queryClient = useQueryClient();
  const customerQuery = useGetCustomer(customerId, { query: { enabled: Number.isFinite(customerId), queryKey: getGetCustomerQueryKey(customerId) } });
  const deleteCustomer = useDeleteCustomer();
  const customer = customerQuery.data as CustomerDetails | undefined;

  function refresh() {
    customerQuery.refetch();
  }

  function removeCustomer() {
    if (!customer || !window.confirm(`למחוק את ${customer.name} ואת היסטוריית התשלומים שלו?`)) return;
    deleteCustomer.mutate({ id: customer.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        notify('הלקוח נמחק');
        setLocation('/');
      },
    });
  }

  if (customerQuery.isLoading) return <main className="min-h-[100dvh] px-5 py-8 lg:px-10"><div className="mx-auto max-w-[1100px] space-y-5"><div className="h-8 w-48 rounded shimmer" /><div className="h-48 rounded-2xl shimmer" /><div className="h-96 rounded-2xl shimmer" /></div></main>;
  if (customerQuery.isError || !customer) return <main className="min-h-[100dvh] px-5 py-8 lg:px-10"><div className="mx-auto max-w-[1100px]"><DashboardError onRetry={refresh} /></div></main>;

  return (
    <main className="workspace-grid min-h-[calc(100dvh-73px)] px-4 py-7 sm:px-6 lg:min-h-[100dvh] lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1100px]">
        <Link href="/" data-testid="link-back-dashboard" className="mb-7 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--primary))]"><ArrowRight size={17} /> חזרה ללוח הבקרה</Link>
        <div className="appear mb-6 flex flex-col gap-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 soft-card sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/0.38)] text-xl font-extrabold text-[hsl(var(--primary))]">{initials(customer.name)}</span>
            <div><h1 data-testid="text-customer-name" className="text-2xl font-extrabold">{customer.name}</h1><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[hsl(var(--muted-foreground))]">{customer.phone && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{customer.phone}</span>}{customer.email && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{customer.email}</span>}</div></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="button-record-payment" onClick={() => setPaymentModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-extrabold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5"><Plus size={17} /> רישום תשלום</button>
            <button type="button" data-testid="button-edit-customer" onClick={() => setEditModal(true)} className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-sm font-bold hover:bg-[hsl(var(--secondary))]"><Pencil size={16} /> עריכה</button>
            <button type="button" data-testid="button-delete-customer" onClick={removeCustomer} disabled={deleteCustomer.isPending} className="inline-flex items-center justify-center rounded-xl border border-[hsl(var(--border))] px-3 py-2.5 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)] disabled:opacity-50"><Trash2 size={16} /></button>
          </div>
        </div>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard icon={WalletCards} label="סך התשלומים" value={money.format(customer.totalPaid)} detail="מהלקוח הזה" accent="bg-[hsl(var(--accent)/0.38)] text-[hsl(var(--primary))]" />
          <StatCard icon={FileText} label="מספר תשלומים" value={String(customer.paymentCount)} detail="רשומות בהיסטוריה" accent="bg-[hsl(var(--secondary))] text-[hsl(var(--chart-2))]" />
          <StatCard icon={UserRound} label="לקוח מאז" value={formatShortDate(customer.createdAt)} detail="תאריך הצטרפות לרשומה" accent="bg-[hsl(var(--chart-3)/0.18)] text-[hsl(var(--chart-3))]" />
        </div>
        <section className="appear soft-card overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-5 sm:px-6"><div><h2 className="text-lg font-extrabold">היסטוריית תשלומים</h2><p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">כל מה שנרשם עבור {customer.name}</p></div><span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs font-bold text-[hsl(var(--primary))]">{customer.payments.length} רשומות</span></div>
          {customer.payments.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Banknote size={25} /></span><h3 className="font-extrabold">עוד לא נרשם תשלום</h3><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">כשהתשלום הראשון יגיע, הוא יופיע כאן.</p><button type="button" data-testid="button-record-first-payment" onClick={() => setPaymentModal(true)} className="mt-5 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]">רישום תשלום ראשון</button></div> : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {customer.payments.map((payment) => <div key={payment.id} data-testid={`row-payment-${payment.id}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Banknote size={18} /></span><div className="min-w-0 flex-1"><strong className="block text-sm">{payment.reason}</strong><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{formatDate(payment.paidAt)}{payment.notes && ` · ${payment.notes}`}</span></div><strong className="text-base text-[hsl(var(--primary))]">{money.format(payment.amount)}</strong></div>)}
            </div>
          )}
        </section>
        {customer.notes && <div className="mt-5 flex gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.5)] p-5 text-sm"><FileText size={18} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" /><div><strong className="block mb-1">הערה על הלקוח</strong><p className="leading-6 text-[hsl(var(--muted-foreground))]">{customer.notes}</p></div></div>}
      </div>
      {editModal && <Modal title="עריכת פרטי לקוח" eyebrow="עדכון רשומה" onClose={() => setEditModal(false)}><CustomerForm customer={customer} onClose={() => setEditModal(false)} onSaved={(updated) => { queryClient.setQueryData(getGetCustomerQueryKey(customer.id), { ...customer, ...updated }); }} notify={notify} /></Modal>}
      {paymentModal && <Modal title="רישום תשלום" eyebrow={`תשלום חדש · ${customer.name}`} onClose={() => setPaymentModal(false)}><PaymentForm customerId={customer.id} onClose={() => setPaymentModal(false)} onSaved={() => { queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(customer.id) }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); }} notify={notify} /></Modal>}
    </main>
  );
}

function AppContent() {
  const [toast, setToast] = useState('');
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3200); };
  return (
    <>
      <Switch>
        <Route path="/customers/:id"><Shell><CustomerDetail notify={notify} /></Shell></Route>
        <Route path="/"><Shell><Dashboard notify={notify} /></Shell></Route>
        <Route component={NotFound} />
      </Switch>
      {toast && <ToastMessage message={toast} onClose={() => setToast('')} />}
    </>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedErrorBoundary><AppContent /></RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;