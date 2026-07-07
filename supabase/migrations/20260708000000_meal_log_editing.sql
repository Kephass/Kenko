-- Deleting a dish/dishware must not fail (or orphan) meal history: keep the
-- log row, null the reference.
alter table meal_logs drop constraint meal_logs_dish_id_fkey;
alter table meal_logs
  add constraint meal_logs_dish_id_fkey
  foreign key (dish_id) references dishes(id) on delete set null;

alter table meal_logs drop constraint meal_logs_dishware_id_fkey;
alter table meal_logs
  add constraint meal_logs_dishware_id_fkey
  foreign key (dishware_id) references dishware(id) on delete set null;
