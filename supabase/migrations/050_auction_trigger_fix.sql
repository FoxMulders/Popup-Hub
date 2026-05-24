-- Fix auction winner notification trigger to match current schema columns.

CREATE OR REPLACE FUNCTION notify_auction_winner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_name TEXT;
  v_pot_amount INTEGER;
BEGIN
  IF NEW.winner_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.winner_user_id IS NOT DISTINCT FROM NEW.winner_user_id THEN
    RETURN NEW;
  END IF;

  SELECT e.name INTO v_event_name
    FROM events e
   WHERE e.id = NEW.event_id;

  v_pot_amount := NEW.pot_amount;

  INSERT INTO notifications (user_id, type, message, metadata)
  VALUES (
    NEW.winner_user_id,
    'auction_won',
    'You won the quarter auction at "' || COALESCE(v_event_name, NEW.title) || '"! 🎉 '
      || 'Your prize pot is $' || (COALESCE(v_pot_amount, 0) / 100.0)::NUMERIC(10,2)::TEXT || '.',
    jsonb_build_object(
      'auction_id', NEW.id,
      'event_id',   NEW.event_id,
      'pot_amount', v_pot_amount,
      'winning_paddle_id', NEW.winning_paddle_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auction_winner_notify ON auctions;
CREATE TRIGGER trg_auction_winner_notify
  AFTER UPDATE OF winner_user_id ON auctions
  FOR EACH ROW EXECUTE FUNCTION notify_auction_winner();
