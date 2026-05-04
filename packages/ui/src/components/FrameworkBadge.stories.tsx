import type { Meta, StoryObj } from "@storybook/react";
import { FrameworkBadge } from "./FrameworkBadge";

const meta: Meta<typeof FrameworkBadge> = {
  title: "Components/FrameworkBadge",
  component: FrameworkBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    framework: {
      control: "select",
      options: ["SOC2", "ISO27001", "GDPR", "NIST_CSF", "SOX"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof FrameworkBadge>;

export const SOC2: Story = { args: { framework: "SOC2" } };
export const ISO27001: Story = { args: { framework: "ISO27001" } };
export const GDPR: Story = { args: { framework: "GDPR" } };
export const NIST_CSF: Story = { args: { framework: "NIST_CSF" } };
export const SOX: Story = { args: { framework: "SOX" } };

export const SmallSize: Story = { args: { framework: "SOC2", size: "sm" } };
export const LargeSize: Story = { args: { framework: "GDPR", size: "lg" } };

export const AllFrameworks: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <FrameworkBadge framework="SOC2" />
      <FrameworkBadge framework="ISO27001" />
      <FrameworkBadge framework="GDPR" />
      <FrameworkBadge framework="NIST_CSF" />
      <FrameworkBadge framework="SOX" />
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <FrameworkBadge framework="SOC2" size="sm" />
      <FrameworkBadge framework="SOC2" size="md" />
      <FrameworkBadge framework="SOC2" size="lg" />
    </div>
  ),
};
