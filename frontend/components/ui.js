import Icon from './Icon';

const STATUS_LABELS = {
  sent: 'Илгээгдсэн',
  failed: 'Амжилтгүй',
  partial: 'Хэсэгчлэн',
  processing: 'Илгээж байна',
  pending: 'Хүлээгдэж буй',
  scheduled: 'Хуваарьт',
  cancelled: 'Цуцлагдсан',
};

export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{STATUS_LABELS[status] || status}</span>;
}

// Амжилттай / амжилтгүй SMS-ийн харьцааг харуулах зурвас
export function DeliveryBar({ sent = 0, failed = 0, total = 0 }) {
  const t = Math.max(total, 1);
  return (
    <div className="progress" title={`${sent} амжилттай, ${failed} амжилтгүй / ${total}`}>
      <span className="ok" style={{ width: `${(sent / t) * 100}%` }} />
      <span className="bad" style={{ width: `${(failed / t) * 100}%` }} />
    </div>
  );
}

// Илгээлтийн хүлээн авагчдын нэрс: эхний 3 нэр + "+N бусад"
export function RecipientNames({ names, count }) {
  if (!count) return <span className="muted">—</span>;
  const shown = (names || []).filter(Boolean);
  const rest = count - shown.length;
  return (
    <div style={{ maxWidth: 220 }}>
      <div className="truncate cell-strong" title={shown.join(', ')}>{shown.join(', ')}</div>
      {rest > 0 && <div className="muted small">+{rest} бусад</div>}
    </div>
  );
}

export function StatCard({ icon, color = 'indigo', value, label }) {
  return (
    <div className="stat">
      <div className={`stat-icon ${color}`}><Icon name={icon} size={20} /></div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'message', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      {title && <h3>{title}</h3>}
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  const icon = type === 'success' ? 'check' : 'alert';
  return (
    <div className={`alert alert-${type}`}>
      <Icon name={icon} size={16} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>{children}</div>
    </div>
  );
}

const ORDER_LABELS = {
  pending: ['awaiting', 'Төлбөр хүлээгдэж буй'],
  paid: ['paid', 'Төлөгдсөн'],
  rejected: ['rejected', 'Татгалзсан'],
  cancelled: ['cancelled', 'Цуцалсан'],
};

export function OrderBadge({ status }) {
  const [cls, label] = ORDER_LABELS[status] || ['', status];
  return <span className={`badge ${cls}`}>{label}</span>;
}


export function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('mn-MN')}₮`;
}

export function formatDate(value) {
  return new Date(value).toLocaleString('mn-MN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
