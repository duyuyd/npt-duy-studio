import Link from "next/link";

export function SiteHeader() {
  return <header className="site-header"><Link href="/" className="brand" aria-label="NuvoraCraft - Trang chủ"><span className="brand-mark">✳</span><span>NPT Duy<span className="brand-muted"> / studio</span></span></Link><nav aria-label="Điều hướng chính"><Link className="nav-link" href="/">Trang chủ</Link><Link className="nav-link studio-nav" href="/dashboard">Dự án của tôi</Link><Link className="nav-button" href="/settings">Founder <span aria-hidden="true">↗</span></Link></nav></header>;
}
