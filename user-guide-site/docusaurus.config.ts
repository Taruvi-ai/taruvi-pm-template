import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Project Management User Guide",
  tagline: "A practical guide for everyday work in the app",
  favicon: "img/favicon.ico",
  future: {
    v4: true,
  },
  url: "https://project-management.local",
  baseUrl: "/user-guide/",
  trailingSlash: true,
  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          showLastUpdateTime: false,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    image: "img/user-guide/dashboard.png",
    colorMode: {
      defaultMode: "light",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "User Guide",
      items: [
        {
          type: "docSidebar",
          sidebarId: "guideSidebar",
          position: "left",
          label: "Browse",
        },
        {
          to: "/",
          label: "Start Here",
          position: "left",
        },
        {
          href: "/",
          label: "Open App",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Guide",
          items: [
            {
              label: "Welcome",
              to: "/",
            },
            {
              label: "Projects",
              to: "/projects-and-views",
            },
          ],
        },
        {
          title: "Daily Work",
          items: [
            {
              label: "My Assignments",
              to: "/my-assignments",
            },
            {
              label: "Calendar View",
              to: "/calendar-view",
            },
          ],
        },
        {
          title: "Open App",
          items: [
            {
              label: "Project Management",
              href: "/",
            },
          ],
        },
      ],
      copyright: `Copyright (c) ${new Date().getFullYear()} Project Management. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
