import type { Meta, StoryObj } from "@storybook/react";
import { ConfidenceChip } from "./ConfidenceChip";

const meta: Meta<typeof ConfidenceChip> = {
  title: "Components/ConfidenceChip",
  component: ConfidenceChip,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100 } },
    variant: {
      control: "select",
      options: ["high", "medium", "low", undefined],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof ConfidenceChip>;

export const High: Story = { args: { value: 94 } };
export const Medium: Story = { args: { value: 67 } };
export const Low: Story = { args: { value: 32 } };

export const ExplicitHigh: Story = {
  args: { value: 45, variant: "high" },
  name: "Explicit variant override (high at 45%)",
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <ConfidenceChip value={94} />
      <ConfidenceChip value={67} />
      <ConfidenceChip value={32} />
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <ConfidenceChip value={94} size="sm" />
      <ConfidenceChip value={94} size="md" />
      <ConfidenceChip value={94} size="lg" />
    </div>
  ),
};
