// Глушит предупреждение консоли Windows о main в bin-цели; логика — в lib.rs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gnomecode_lib::run()
}
