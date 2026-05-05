import type { Meta, StoryObj } from "@storybook/react";
import { ActionSpotlight } from "./ActionSpotlight";

const meta: Meta<typeof ActionSpotlight> = {
  title: "Components/ActionSpotlight",
  component: ActionSpotlight,
};

export default meta;
type Story = StoryObj<typeof ActionSpotlight>;

export const NormalCollapsed: Story = {
  args: {
    variant: "normal",
    title: "Review: AWS IAM access review",
    description: "Review the latest information and confirm everything looks correct.",
    primaryLabel: "Start review →",
    onPrimary: () => {},
    whyNeededText: null,
  },
};

export const NormalExpanded: Story = {
  args: {
    ...NormalCollapsed.args,
    whyNeededText:
      "This keeps access permissions accurate and reduces surprises later. It also creates a clear record of what you checked and when.",
  },
};

export const Urgent: Story = {
  args: {
    variant: "urgent",
    title: "Review: Vendor access list",
    description: "A review is due soon. Confirm the current list is still correct.",
    primaryLabel: "Start review →",
    onPrimary: () => {},
    whyNeededText: null,
  },
};

export const Complete: Story = {
  args: {
    variant: "complete",
    title: "Review: Okta user offboarding",
    description: "Done. Nothing else is needed from you.",
    primaryLabel: "Start review →",
    onPrimary: () => {},
    whyNeededText: null,
  },
};

