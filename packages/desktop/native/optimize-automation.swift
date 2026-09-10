import Cocoa
import ApplicationServices
import Security

struct AutomationError: Error { let message: String }
func fail(_ message: String) throws -> Never { throw AutomationError(message: message) }
func emit(_ value: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) { FileHandle.standardOutput.write(data) }
}
let service = "bike.optimize.microsoft365"
func keychain(_ input: [String: Any]) throws -> [String: Any] {
    let action = input["action"] as? String ?? ""
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "current-user"]
    if action == "credential-delete" {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { try fail("Keychain deletion failed: \(status)") }
        return ["ok": true]
    }
    if action == "credential-write" {
        guard let value = input["value"] as? String, let data = value.data(using: .utf8) else { try fail("Missing credential value") }
        var status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrLabel as String] = "Optimize Microsoft 365"
            item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess else { try fail("Keychain storage failed: \(status)") }
        return ["ok": true]
    }
    var read = query
    read[kSecReturnData as String] = true
    read[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(read as CFDictionary, &result)
    if status == errSecItemNotFound { return ["value": NSNull()] }
    guard status == errSecSuccess, let data = result as? Data, let value = String(data: data, encoding: .utf8) else { try fail("Keychain read failed: \(status)") }
    return ["value": value]
}
func permissions(_ prompt: Bool) -> [String: Any] {
    let trusted = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary)
    let capture = CGPreflightScreenCaptureAccess()
    if prompt && !capture { _ = CGRequestScreenCaptureAccess() }
    return ["accessibility": trusted, "screenRecording": capture]
}
func axValue(_ element: AXUIElement, _ attribute: String) -> CFTypeRef? {
    var result: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, attribute as CFString, &result) == .success ? result : nil
}
func accessibilityText(_ app: NSRunningApplication) -> [[String: String]] {
    let element = AXUIElementCreateApplication(app.processIdentifier)
    AXUIElementSetMessagingTimeout(element, 0.3)
    var queue: [(AXUIElement, Int)] = [(element, 0)]
    var output: [[String: String]] = []
    var visited = 0
    let deadline = Date().addingTimeInterval(3)
    while !queue.isEmpty && visited < 300 && Date() < deadline {
        let (item, depth) = queue.removeFirst()
        visited += 1
        let role = axValue(item, kAXRoleAttribute) as? String ?? ""
        var row = ["role": role]
        for (name, attribute) in [("title", kAXTitleAttribute), ("description", kAXDescriptionAttribute)] {
            if let value = axValue(item, attribute) as? String, !value.isEmpty { row[name] = String(value.prefix(1000)) }
        }
        if (axValue(item, kAXSubroleAttribute) as? String) != "AXSecureTextField", let value = axValue(item, kAXValueAttribute) as? String, !value.isEmpty { row["value"] = String(value.prefix(2000)) }
        if row.count > 1 { output.append(row) }
        if depth < 8, let children = axValue(item, kAXChildrenAttribute) as? [AXUIElement] {
            queue.append(contentsOf: children.prefix(80).map { ($0, depth + 1) })
        }
    }
    return output
}
func observe() throws -> [String: Any] {
    guard CGPreflightScreenCaptureAccess() else { try fail("Enable Screen Recording for Optimize Automation in macOS Privacy & Security, then retry.") }
    guard let captured = CGDisplayCreateImage(CGMainDisplayID()) else { try fail("Display capture unavailable.") }
    let factor = min(1, 1600.0 / Double(captured.width))
    let width = Int(Double(captured.width) * factor), height = Int(Double(captured.height) * factor)
    guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { try fail("Cannot allocate capture.") }
    context.draw(captured, in: CGRect(x: 0, y: 0, width: width, height: height))
    guard let image = context.makeImage(), let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else { try fail("Cannot encode capture.") }
    let bounds = CGDisplayBounds(CGMainDisplayID())
    let front = NSWorkspace.shared.frontmostApplication
    var output: [String: Any] = ["image": data.base64EncodedString(), "imageWidth": width, "imageHeight": height, "displayWidth": bounds.width, "displayHeight": bounds.height, "coordinateSystem": "Main display logical points, top-left origin. Scale image coordinates by displayWidth/imageWidth and displayHeight/imageHeight."]
    if let front = front {
        output["app"] = front.localizedName ?? ""
        output["bundleId"] = front.bundleIdentifier ?? ""
        if AXIsProcessTrusted() { output["elements"] = accessibilityText(front) }
    }
    return output
}
func flags(_ input: [String: Any]) throws -> CGEventFlags {
    var result: CGEventFlags = []
    for name in input["modifiers"] as? [String] ?? [] {
        switch name.lowercased() {
        case "command", "cmd", "super": result.insert(.maskCommand)
        case "shift": result.insert(.maskShift)
        case "option", "alt": result.insert(.maskAlternate)
        case "control", "ctrl": result.insert(.maskControl)
        default: try fail("Unknown modifier: \(name)")
        }
    }
    return result
}
func key(_ input: [String: Any]) throws {
    let keys: [String: CGKeyCode] = ["a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23, "9": 25, "7": 26, "8": 28, "0": 29, "o": 31, "u": 32, "i": 34, "p": 35, "enter": 36, "return": 36, "l": 37, "j": 38, "k": 40, "n": 45, "m": 46, "tab": 48, "space": 49, "backspace": 51, "escape": 53, "delete": 117, "left": 123, "right": 124, "down": 125, "up": 126]
    guard let name = input["key"] as? String, let code = keys[name.lowercased()] else { try fail("Unsupported key.") }
    let modifiers = try flags(input)
    for pressed in [true, false] {
        let event = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: pressed)
        event?.flags = modifiers
        event?.post(tap: .cghidEventTap)
    }
}
func postText(_ units: [UniChar]) {
    for pressed in [true, false] {
        let event = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: pressed)
        event?.keyboardSetUnicodeString(stringLength: units.count, unicodeString: units)
        event?.post(tap: .cghidEventTap)
    }
}
func operate(_ input: [String: Any]) throws -> [String: Any] {
    guard let action = input["action"] as? String else { try fail("Missing action") }
    if action.hasPrefix("credential-") { return try keychain(input) }
    if action == "permissions" { return permissions(input["prompt"] as? Bool ?? false) }
    if action == "observe" { return try observe() }
    guard AXIsProcessTrusted(), CGPreflightScreenCaptureAccess() else { try fail("Enable Accessibility and Screen Recording for Optimize Automation in macOS Privacy & Security.") }
    if action == "open" {
        guard let id = input["bundleId"] as? String, let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: id) else { try fail("Application not found by bundle ID.") }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        var done = false
        var launchError: Error?
        NSWorkspace.shared.openApplication(at: url, configuration: configuration) { _, error in launchError = error; done = true }
        let deadline = Date().addingTimeInterval(10)
        while !done && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.05)) }
        if let error = launchError { throw error }
        guard done else { try fail("Application did not finish opening.") }
    } else {
        guard let expected = input["expectedApp"] as? String, !expected.isEmpty, NSWorkspace.shared.frontmostApplication?.bundleIdentifier == expected else { try fail("The foreground app changed. Observe again before acting.") }
        switch action {
        case "click":
            guard let x = input["x"] as? Double, let y = input["y"] as? Double, x.isFinite, y.isFinite, CGDisplayBounds(CGMainDisplayID()).contains(CGPoint(x: x, y: y)) else { try fail("Click outside the main display.") }
            let right = input["button"] as? String == "right"
            let count = min(2, max(1, input["clicks"] as? Int ?? 1))
            for index in 1...count {
                for pressed in [true, false] {
                    let type: CGEventType = right ? (pressed ? .rightMouseDown : .rightMouseUp) : (pressed ? .leftMouseDown : .leftMouseUp)
                    let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: CGPoint(x: x, y: y), mouseButton: right ? .right : .left)
                    event?.setIntegerValueField(.mouseEventClickState, value: Int64(index))
                    event?.flags = try flags(input)
                    event?.post(tap: .cghidEventTap)
                }
            }
        case "type":
            guard let text = input["text"] as? String, text.utf16.count <= 20000 else { try fail("Invalid text") }
            var chunk: [UniChar] = []
            for scalar in text.unicodeScalars {
                let units = Array(String(scalar).utf16)
                if chunk.count + units.count > 20 {
                    postText(chunk)
                    chunk.removeAll(keepingCapacity: true)
                }
                chunk.append(contentsOf: units)
            }
            if !chunk.isEmpty { postText(chunk) }

        case "key": try key(input)
        case "scroll":
            guard let delta = input["delta"] as? Int32, abs(Int64(delta)) <= 2000 else { try fail("Invalid scroll delta") }
            CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1, wheel1: delta, wheel2: 0, wheel3: 0)?.post(tap: .cghidEventTap)
        default: try fail("Unknown action")
        }
    }
    Thread.sleep(forTimeInterval: 0.25)
    return try observe()
}
do {
    let bytes = FileHandle.standardInput.readDataToEndOfFile()
    guard bytes.count <= 4_000_000, let input = try JSONSerialization.jsonObject(with: bytes) as? [String: Any] else { try fail("Invalid request") }
    emit(try operate(input))
} catch let error as AutomationError { emit(["error": error.message]) }
catch { emit(["error": error.localizedDescription]) }
