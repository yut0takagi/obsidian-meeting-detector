import { describe, it, expect, vi } from "vitest";
import {
	NotificationCtor,
	shouldNotifyDesktop,
	showDesktopNotification,
} from "../src/desktop-notification";

function fakeCtor(permission = "granted") {
	const created: Array<{ title: string; body?: string; onclick: (() => void) | null; close: () => void }> = [];
	class FakeNotification {
		static permission = permission;
		onclick: (() => void) | null = null;
		close = vi.fn();
		constructor(public title: string, options?: { body?: string }) {
			created.push(Object.assign(this, { body: options?.body }));
		}
	}
	return { ctor: FakeNotification as unknown as NotificationCtor, created };
}

describe("shouldNotifyDesktop", () => {
	it("notifies only when enabled and Obsidian is in the background", () => {
		expect(shouldNotifyDesktop(true, false)).toBe(true);
		expect(shouldNotifyDesktop(true, true)).toBe(false);
		expect(shouldNotifyDesktop(false, false)).toBe(false);
	});
});

describe("showDesktopNotification", () => {
	it("shows a notification and runs the click handler", () => {
		const { ctor, created } = fakeCtor();
		const onClick = vi.fn();
		expect(showDesktopNotification(ctor, "Meeting detected", "Zoom is running.", onClick)).not.toBeNull();
		expect(created[0]?.title).toBe("Meeting detected");
		expect(created[0]?.body).toBe("Zoom is running.");
		created[0]?.onclick?.();
		expect(onClick).toHaveBeenCalled();
		expect(created[0]?.close).toHaveBeenCalled();
	});

	it("does nothing when notifications are denied or unavailable", () => {
		const { ctor, created } = fakeCtor("denied");
		expect(showDesktopNotification(ctor, "t", "b", vi.fn())).toBeNull();
		expect(created).toHaveLength(0);
		expect(showDesktopNotification(undefined, "t", "b", vi.fn())).toBeNull();
	});

	it("does not throw when the constructor fails", () => {
		const Throwing = function () {
			throw new Error("not allowed");
		} as unknown as NotificationCtor;
		expect(showDesktopNotification(Throwing, "t", "b", vi.fn())).toBeNull();
	});
});
