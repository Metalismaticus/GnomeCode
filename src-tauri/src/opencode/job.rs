//! Windows Job Object: смерть ручки у хозяина — смерть назначенного ребёнка.
//!
//! Движок — чужой процесс, и жёсткое убийство приложения оставляло его жить
//! сиротой (замечено 2026-10-06). Теперь процесс приложения держит у себя
//! ручку job с лимитом KILL_ON_JOB_CLOSE и назначает в job движок-ребёнка:
//! пока жив хозяин — жива ручка; при смерти процесса ОС закрывает его ручки
//! сама и убивает ребёнка, ничего в коде для этого звать не нужно. Штатная
//! остановка ([`Engine::stop`]) работает как раньше — kill и wait, job здесь
//! только страховка сиротства.

// Кернел-ручка работает из любого потока процесса; в windows-крейте HANDLE не
// Send из осторожности, а не из-за настоящей привязки к потоку. `Engine` —
// Send (`EngineLife`), поэтому job обязан быть им тоже.
unsafe impl Send for Job {}

#[cfg(windows)]
use std::os::windows::io::AsRawHandle;
use std::process::Child;

/// Job процесса-хозяина: назначенные дети умирают вместе с последней ручкой.
pub struct Job {
    #[cfg(windows)]
    handle: windows::Win32::Foundation::HANDLE,
}

impl Job {
    /// Новый job с KILL_ON_JOB_CLOSE: без назначенных детей закрытие безвредно.
    pub fn new() -> Result<Self, String> {
        #[cfg(windows)]
        unsafe {
            use windows::core::PCWSTR;
            use windows::Win32::Foundation::CloseHandle;
            use windows::Win32::System::JobObjects::{
                CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
                JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            };
            let handle = CreateJobObjectW(None, PCWSTR::null())
                .map_err(|e| format!("создание job: {e}"))?;
            let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let set = SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if let Err(e) = set {
                let _ = CloseHandle(handle);
                return Err(format!("лимит KILL_ON_JOB_CLOSE: {e}"));
            }
            Ok(Self { handle })
        }
        #[cfg(not(windows))]
        Ok(Self {})
    }

    /// Назначить ребёнка в job: его собственные дети наследуют membership —
    /// помощники движка не переживут хозяина тоже.
    pub fn assign(&self, child: &Child) -> Result<(), String> {
        #[cfg(windows)]
        unsafe {
            use windows::Win32::Foundation::HANDLE;
            use windows::Win32::System::JobObjects::AssignProcessToJobObject;
            AssignProcessToJobObject(self.handle, HANDLE(child.as_raw_handle()))
                .map_err(|e| format!("назначение в job: {e}"))
        }
        #[cfg(not(windows))]
        {
            let _ = child;
            Ok(())
        }
    }
}

impl Drop for Job {
    /// Закрытие последней ручки: ОС убивает назначенных (KILL_ON_JOB_CLOSE) —
    /// так смерть процесса приложения добирается до движка-ребёнка.
    fn drop(&mut self) {
        #[cfg(windows)]
        unsafe {
            use windows::Win32::Foundation::CloseHandle;
            let _ = CloseHandle(self.handle);
        }
    }
}
