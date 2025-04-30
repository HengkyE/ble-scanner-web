"use client";

import { Card, Divider } from "antd";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  className?: string;
}

export default function StatCard({ title, value, icon, description, className }: StatCardProps) {
  return (
    <Card
      className={`${className} hover:shadow-md transition-all duration-200`}
      title={
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-500">{title}</span>
          {icon && <div className="text-primary">{icon}</div>}
        </div>
      }
    >
      <Divider className="my-1" />
      <div className="flex flex-col pt-2">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {description && <div className="text-xs text-gray-500 mt-1">{description}</div>}
      </div>
    </Card>
  );
}
