import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { EatListEditor } from "./EatListEditor";
import { eatListApi, EatListEntry } from "../../api/eatList";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Modal: "Modal",
  Platform: { OS: "ios" },
  StyleSheet: { create: (styles: any) => styles },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock("../../api/eatList", () => ({
  eatListApi: {
    membership: jest.fn(),
    get: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock("../home/HomeImage", () => ({ HomeImage: "HomeImage" }));
jest.mock("../../api/client", () => ({ API_BASE_URL: "https://test/api/v1" }));
jest.mock("../../theme/homeArt", () => ({ HOME_ART: {} }));
jest.mock("../Button", () => ({
  Button: (props: any) => jest.requireActual("react").createElement("Button", props),
}));
const target = {
  outletId: "outlet-1",
  menuItemId: "dish-1",
  name: "Paneer Tikka",
  restaurantName: "Green Kitchen",
};
const existing = {
  ...target,
  id: "saved-1",
  note: "Original note",
  plannedDate: "2026-12-24",
  plannedTime: "20:00",
  timeZone: "Asia/Kolkata",
  createdAt: "2026-11-21T10:00:00Z",
} as unknown as EatListEntry;
const mock = eatListApi as jest.Mocked<typeof eatListApi>;
let renderer: TestRenderer.ReactTestRenderer;
const text = () =>
  renderer.root
    .findAllByType("Text" as any)
    .map((node) => [].concat(node.props.children).join(""))
    .join(" ");
const press = async (label: string) => {
  await act(async () => {
    renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
  });
};
const save = async () => {
  await act(async () => {
    renderer.root.findByType("Button" as any).props.onPress();
  });
};
const note = async (value: string) => {
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: "Eat List note" })
      .props.onChangeText(value);
  });
};
async function render(initialEntry?: EatListEntry) {
  const saved = jest.fn();
  await act(async () => {
    renderer = TestRenderer.create(
      <EatListEditor
        target={target}
        initialEntry={initialEntry}
        onClose={jest.fn()}
        onSaved={saved}
      />,
    );
  });
  return saved;
}
beforeEach(() => {
  jest.clearAllMocks();
  mock.membership.mockResolvedValue([]);
  mock.save.mockResolvedValue(existing);
  mock.update.mockResolvedValue(existing);
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
});
describe("Eat List planner", () => {
  it("saves a new dish and optional note without inventing a date or time", async () => {
    const saved = await render();
    await note("  Try with friends  ");
    await save();
    expect(mock.save).toHaveBeenCalledWith(target, {
      note: "Try with friends",
      plannedDate: null,
      plannedTime: null,
      timeZone: null,
    });
    expect(saved).toHaveBeenCalledTimes(1);
  });
  it("loads an existing bookmark before editing so a repeated save preserves its note", async () => {
    mock.membership.mockResolvedValue([
      { id: existing.id, menuItemId: target.menuItemId },
    ]);
    mock.get.mockResolvedValue(existing);
    await render();
    expect(
      renderer.root.findByProps({ accessibilityLabel: "Eat List note" }).props
        .value,
    ).toBe("Original note");
    await note("New note");
    await save();
    expect(mock.update).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({
        note: "New note",
        plannedDate: existing.plannedDate,
      }),
    );
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("clears time and zone together when a plan moves to Someday", async () => {
    await render(existing);
    await press("Someday");
    await save();
    expect(mock.update).toHaveBeenCalledWith(existing.id, {
      note: "Original note",
      plannedDate: null,
      plannedTime: null,
      timeZone: null,
    });
  });
  it("rejects an invalid clock time before sending a database write", async () => {
    await render(existing);
    await act(async () =>
      renderer.root
        .findByProps({ accessibilityLabel: "Planned time, 24 hour format" })
        .props.onChangeText("25:90"),
    );
    await save();
    expect(mock.update).not.toHaveBeenCalled();
    expect(text()).toContain("Choose a day and enter a time");
  });
  it("keeps an unsaved note available after a failed save", async () => {
    mock.save.mockRejectedValueOnce(new Error("Connection lost"));
    const saved = await render();
    await note("Do not lose my note");
    await save();
    expect(saved).not.toHaveBeenCalled();
    expect(text()).toContain("Connection lost");
    expect(
      renderer.root.findByProps({ accessibilityLabel: "Eat List note" }).props
        .value,
    ).toBe("Do not lose my note");
    await save();
    expect(saved).toHaveBeenCalledTimes(1);
  });
  it("blocks writes if saved details cannot be checked, and offers retry", async () => {
    mock.membership.mockRejectedValueOnce(new Error("Offline"));
    await render();
    expect(text()).toContain("Couldn’t load this dish’s saved details");
    expect(
      renderer.root
        .findAllByType("Button" as any)
        .find((node) => node.props.title === "Save to Eat List")!.props
        .disabled,
    ).toBe(true);
    expect(mock.save).not.toHaveBeenCalled();
  });
});
