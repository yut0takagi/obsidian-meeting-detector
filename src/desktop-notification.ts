/**
 * System notifications for when Obsidian is in the background and the
 * meeting popup would go unseen. Uses the browser Notification API, so
 * nothing leaves the machine.
 */

export interface NotificationLike {
	onclick: (() => void) | null;
	close(): void;
}

export interface NotificationCtor {
	new (title: string, options?: { body?: string }): NotificationLike;
	permission?: string;
}

export function shouldNotifyDesktop(enabled: boolean, windowFocused: boolean): boolean {
	return enabled && !windowFocused;
}

/** Shows a notification whose click runs `onClick`. Returns null when notifications are unavailable. */
export function showDesktopNotification(
	ctor: NotificationCtor | undefined,
	title: string,
	body: string,
	onClick: () => void
): NotificationLike | null {
	if (!ctor || ctor.permission === "denied") return null;
	try {
		const notification = new ctor(title, { body });
		notification.onclick = () => {
			onClick();
			notification.close();
		};
		return notification;
	} catch {
		return null;
	}
}
