use tauri_plugin_autostart::MacosLauncher;

#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};

#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_positioner::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // --- System tray with menu ---
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::TrayIconBuilder;
                use tauri::Manager;

                let toggle = MenuItem::with_id(app, "toggle", "Show / Hide", true, None::<&str>)?;
                let quit_item =
                    MenuItem::with_id(app, "quit", "Quit Top Focus", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&toggle, &quit_item])?;

                let icon = app
                    .default_window_icon()
                    .cloned()
                    .expect("no default window icon configured");

                TrayIconBuilder::new()
                    .icon(icon)
                    .icon_as_template(true)
                    .menu(&menu)
                    .on_menu_event(move |app, event| match event.id.as_ref() {
                        "toggle" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .build(app)?;
            }

            // --- macOS NSPanel behavior (WIN-02, WIN-03) ---
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                let window = app.get_webview_window("main").expect("main window not found");

                let ns_window = window.ns_window().expect("failed to get ns_window");
                let ns_window = ns_window as *mut objc::runtime::Object;

                unsafe {
                    // Non-activating panel behavior (WIN-02)
                    let current_mask: u64 = msg_send![ns_window, styleMask];
                    let non_activating_panel: u64 = 1 << 7;
                    let new_mask = current_mask | non_activating_panel;
                    let _: () = msg_send![ns_window, setStyleMask: new_mask];

                    // Visible on all Spaces (WIN-03)
                    let can_join_all_spaces: u64 = 1 << 0;
                    let stationary: u64 = 1 << 4;
                    let full_screen_auxiliary: u64 = 1 << 8;
                    let behavior = can_join_all_spaces | stationary | full_screen_auxiliary;
                    let _: () = msg_send![ns_window, setCollectionBehavior: behavior];

                    // Floating window level
                    let floating_level: i64 = 3;
                    let _: () = msg_send![ns_window, setLevel: floating_level];
                }

                // --- Hide from Dock & Cmd-Tab ---
                // Must happen AFTER window + tray are created, otherwise the
                // window never appears.  We then re-show the window to ensure
                // it is visible despite the policy change.
                unsafe {
                    let cls = objc::class!(NSApplication);
                    let ns_app: *mut objc::runtime::Object =
                        msg_send![cls, sharedApplication];
                    // NSApplicationActivationPolicyAccessory = 1
                    let _: () = msg_send![ns_app, setActivationPolicy: 1i64];
                }

                // Re-show window after policy change
                let _ = window.show();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![quit])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
