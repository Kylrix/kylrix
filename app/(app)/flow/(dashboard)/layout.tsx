import React from 'react';
import MainLayout from "@/components/layout/MainLayout";

export default function FlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
