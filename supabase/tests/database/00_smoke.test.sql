-- Confirms that pgTAP runs. Real RLS and function tests start with step 1.
begin;
select plan(1);

select ok(true, 'pgTAP is available');

select * from finish();
rollback;
