/**
 * iOS Share Extension — stubbed for Xcode project integration.
 *
 * To activate:
 * 1. Open ios/MyDropAlpha.xcworkspace in Xcode
 * 2. File → New → Target → Share Extension (name: "MyDropShare")
 * 3. Set the extension's Info.plist NSExtensionActivationRule to support
 *    text, images, and files.
 * 4. Replace the generated ShareViewController.swift with:
 *    - Read NSExtensionItem attachments
 *    - Write JSON to shared App Group container
 *    - Signal the main app via CFNotificationCenterDarwin
 *
 * On the main app side, this module reads from the shared container
 * on becoming active and injects items through V1MobileStore.
 */

export function checkiOSShareExtension(): boolean {
  return false;
}
