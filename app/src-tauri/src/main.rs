// Verhindert ein zusätzliches Konsolenfenster unter Windows (Release).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    einrichtungsplaner_lib::run()
}
