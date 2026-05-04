import type { Meta, StoryObj } from "@storybook/react";
import { StatusChip } from "./StatusChip";

const meta: Meta<typeof StatusChip> = {
  title: "Components/StatusChip",
  component: StatusChip,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["pass", "warn", "fail", "auto", "pending"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
    compact: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof StatusChip>;

export const Pass: Story = { args: { variant: "pass" } };
export const Warn: Story = { args: { variant: "warn" } };
export const Fail: Story = { args: { variant: "fail" } };
export const Auto: Story = { args: { variant: "auto" } };
export const Pending: Story = { args: { variant: "pending" } };

export const SmallSize: Story = { args: { variant: "pass", size: "sm" } };
export const LargeSize: Story = { args: { variant: "fail", size: "lg" } };

export const Compact: Story = { args: { variant: "pass", compact: true } };

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <StatusChip variant="pass" />
      <StatusChip variant="warn" />
      <StatusChip variant="fail" />
      <StatusChip variant="auto" />
      <StatusChip variant="pending" />
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <StatusChip variant="pass" size="sm" />
      <StatusChip variant="pass" size="md" />
      <StatusChip variant="pass" size="lg" />
    </div>
  ),
};
