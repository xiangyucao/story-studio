"use client";

import { ArrowLeft, Printer } from "lucide-react";

export function PrintActions() {
  return <div className="print-actions"><button onClick={() => window.close()}><ArrowLeft size={16} />返回</button><button onClick={() => window.print()}><Printer size={16} />打印 / 保存为 PDF</button></div>;
}
