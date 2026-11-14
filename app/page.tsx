"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { SiteHeader } from "@/components/SiteHeader";
import { usePlatform } from "@/lib/platform/PlatformProvider";

export default function HomePage() {
  const { settings } = usePlatform();
  const reduceMotion = useReducedMotion();
  return <><SiteHeader /><main className="home-wrap"><motion.div initial={reduceMotion ? false : { opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="home-content"><div className="eyebrow"><span className="status-dot" /> KHÔNG GIAN SÁNG TẠO CỦA BẠN</div><h1>{settings.hero_title}<span className="accent">.</span></h1><p>Quản lý giao diện nền tảng từ một nơi. Các công cụ xây dựng sản phẩm sẽ được phát triển trong những giai đoạn tiếp theo.</p><div className="flex flex-wrap gap-3"><Link href="/settings" className="primary-button">Mở cài đặt Founder <span aria-hidden="true">↗</span></Link><span className="home-note">Phase 1 · nền tảng cấu hình</span></div></motion.div><div className="home-art" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="art-card"><div className="art-dots"><i /><i /><i /></div><div className="art-lines"><i /><i /><i /></div><div className="art-blocks"><i /><i /><i /></div></div></div></main><footer className="site-footer"><span>NPT DUY / STUDIO</span><span>XÂY DỰNG THEO CÁCH CỦA BẠN</span></footer></>;
}
