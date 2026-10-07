import Icon from './Icon';

// Хэрэглэгч / Admin нэвтрэх хуудас хооронд сэлгэх
export function LoginSwitch({ active }) {
  return (
    <div className="segmented login-switch">
      <a href="/login" className={active === 'user' ? 'active' : ''}>
        <Icon name="user" size={15} /> Хэрэглэгч
      </a>
      <a href="/admin/login" className={active === 'admin' ? 'active' : ''}>
        <Icon name="shield" size={15} /> Admin
      </a>
    </div>
  );
}

// Нэвтрэх / бүртгүүлэх хуудасны хоёр хуваагдсан загвар
export default function AuthLayout({ variant, children }) {
  const isAdmin = variant === 'admin';
  return (
    <div className="auth">
      <div className={`auth-brand ${isAdmin ? 'admin' : ''}`}>
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-logo"><Icon name={isAdmin ? 'shield' : 'message'} size={18} /></span>
          <span className="brand-name">WEB2SMS{isAdmin && ' · Admin'}</span>
        </div>

        <div>
          {isAdmin ? (
            <>
              <h2>Системийн удирдлага</h2>
              <p>Байгууллага, хэрэглэгч, кредит болон бүх илгээлтийг нэг дороос хянана.</p>
            </>
          ) : (
            <>
              <h2>Байгууллагын бөөний SMS үйлчилгээ</h2>
              <p>Харилцагчиддаа мэдэгдэл, урамшуулал, сануулгыг хурдан, найдвартай хүргэ.</p>
            </>
          )}
        </div>

        <p style={{ opacity: 0.6, fontSize: 13 }}>© {new Date().getFullYear()} WEB2SMS</p>
      </div>

      <div className="auth-main">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}
