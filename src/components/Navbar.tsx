"use client";

import React from "react";
import { Layout, Menu, Button, Dropdown, Space } from "antd";
import { GithubOutlined } from "@ant-design/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

const { Header } = Layout;

export default function AppNavbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { key: "/", label: "Dashboard", path: "/" },
    { key: "/devices", label: "Devices", path: "/devices" },
    { key: "/maps", label: "Maps", path: "/maps" },
    { key: "/compare", label: "Compare", path: "/compare" },
    { key: "/crowd-analysis", label: "Crowd Analysis", path: "/crowd-analysis" },
    { key: "/water-levels", label: "Water Levels", path: "/water-levels" },
  ];

  const themeItems = [
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
    { key: "system", label: "System" },
  ];

  return (
    <Header className="bg-white flex items-center justify-between px-4 border-b border-gray-200">
      <div className="flex items-center">
        <Link href="/" className="flex items-center gap-2 mr-8">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-primary"
          >
            <path
              d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M7.5 12C9.15685 12 10.5 10.6569 10.5 9C10.5 7.34315 9.15685 6 7.5 6C5.84315 6 4.5 7.34315 4.5 9C4.5 10.6569 5.84315 12 7.5 12Z"
              fill="currentColor"
            />
            <path
              d="M16.5 18C18.1569 18 19.5 16.6569 19.5 15C19.5 13.3431 18.1569 12 16.5 12C14.8431 12 13.5 13.3431 13.5 15C13.5 16.6569 14.8431 18 16.5 18Z"
              fill="currentColor"
            />
            <path d="M10.5 9L13.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="font-medium text-xl tracking-tight">BLE Scanner</span>
        </Link>

        <Menu
          mode="horizontal"
          selectedKeys={[pathname]}
          className="flex-1 border-0"
          items={navItems.map((item) => ({
            key: item.key,
            label: (
              <Link href={item.path} className="font-medium text-sm tracking-wide">
                {item.label}
              </Link>
            ),
          }))}
        />
      </div>

      <Space className="flex items-center">
        <Dropdown
          menu={{
            items: themeItems,
            selectable: true,
            defaultSelectedKeys: [theme || "system"],
            onClick: ({ key }) => setTheme(key),
          }}
          placement="bottomRight"
        >
          <Button type="text">
            {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System"}
          </Button>
        </Dropdown>

        <Button
          type="text"
          icon={<GithubOutlined />}
          href="https://github.com/hengkysuryaa/ble-scanner-web"
          target="_blank"
          shape="circle"
        />
      </Space>
    </Header>
  );
}
