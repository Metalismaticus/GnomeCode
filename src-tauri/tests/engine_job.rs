//! Механика Job Object: смерть ручки job у хозяина — смерть назначенного ребёнка.
//!
//! Приложение держит ручку job у себя и назначает в job движок-ребёнка. При
//! жёстком убийстве процесса приложения ОС закрывает все его ручки — лимит
//! KILL_ON_JOB_CLOSE убивает движок, сироты не остаётся. Проверка живёт в одном
//! процессе с «хозяином»: закрытие ручки здесь — то же, что смерть процесса
//! приложения, ничего сильнее ОС сделать не может.

#![cfg(windows)]

use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use gnomecode_lib::opencode::job::Job;

const ALIVE_WAIT: Duration = Duration::from_secs(15);

/// Долгоживущий ребёнок без вывода: `ping` спит по секунде, тридцати хватит.
fn sleeper() -> Command {
    let mut command = Command::new("cmd");
    command
        .args(["/C", "ping", "-n", "30", "127.0.0.1"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .stdin(Stdio::null());
    command
}

/// Ребёнок жив: `try_wait` не убивает и не ждёт.
fn alive(child: &mut Child) -> bool {
    matches!(child.try_wait(), Ok(None))
}

/// Ждать смерть ребёнка: `true` — умер в срок, `false` — переждал лимит.
fn dies_within(child: &mut Child, limit: Duration) -> bool {
    let deadline = Instant::now() + limit;
    while Instant::now() < deadline {
        if !alive(child) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    !alive(child)
}

#[test]
fn assigned_child_dies_when_the_host_job_handle_closes() {
    let job = Job::new().expect("job создан");
    let mut assigned = sleeper().spawn().expect("назначаемый ребёнок запущен");
    let mut bystander = sleeper().spawn().expect("сторонний ребёнок запущен");

    job.assign(&assigned)
        .expect("ребёнок назначен в job хозяина");
    assert!(alive(&mut assigned), "после назначения ребёнок жив");

    // Ручка ушла — как при жёстком убийстве процесса-хозяина: ОС закрывает
    // ручки, KILL_ON_JOB_CLOSE убивает назначенного, сторонний не задет.
    drop(job);
    assert!(
        dies_within(&mut assigned, ALIVE_WAIT),
        "назначенный ребёнок пережил закрытие job-ручки хозяина"
    );
    assert!(
        alive(&mut bystander),
        "закрытие job-ручки убило неназначенного ребёнка — механика не при чём"
    );

    let _ = bystander.kill();
    let _ = bystander.wait();
}

#[test]
fn job_takes_a_new_child_after_the_former_died() {
    // Перезапуск движка: штатная остановка убивает ребёнка, тот же job
    // назначает нового — закрывшийся позже job убивает уже его.
    let job = Job::new().expect("job создан");
    let mut first = sleeper().spawn().expect("первый ребёнок запущен");
    job.assign(&first).expect("первый ребёнок назначен в job");
    let _ = first.kill();
    let _ = first.wait();

    let mut second = sleeper().spawn().expect("второй ребёнок запущен");
    job.assign(&second)
        .expect("второй ребёнок назначен в тот же job");

    drop(job);
    assert!(
        dies_within(&mut second, ALIVE_WAIT),
        "второй ребёнок пережил закрытие job-ручки"
    );
}
