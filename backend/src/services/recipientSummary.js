// Илгээлт бүрийн хүлээн авагчдыг төрлөөр нь (байгууллага / харилцагч) тоолж, эхний 3 нэрийг өгөх
// LATERAL join. "messages m" alias-тай query-д "rc" нэрээр нэгтгэнэ:
//   SELECT m.*, rc.org_count, rc.client_count, rc.org_names, rc.client_names FROM messages m ${RECIPIENT_SUMMARY_JOIN}
const RECIPIENT_SUMMARY_JOIN = `
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE mr.recipient_type = 'organization')::int AS org_count,
      COUNT(*) FILTER (WHERE mr.recipient_type IS DISTINCT FROM 'organization')::int AS client_count,
      (array_agg(mr.recipient_name ORDER BY mr.id)
         FILTER (WHERE mr.recipient_type = 'organization'))[1:3] AS org_names,
      (array_agg(COALESCE(mr.recipient_name, c.name, mr.phone) ORDER BY mr.id)
         FILTER (WHERE mr.recipient_type IS DISTINCT FROM 'organization'))[1:3] AS client_names
    FROM message_recipients mr
    LEFT JOIN contacts c ON c.id = mr.contact_id
    WHERE mr.message_id = m.id
  ) rc ON TRUE`;

const RECIPIENT_SUMMARY_COLUMNS = 'rc.org_count, rc.client_count, rc.org_names, rc.client_names';

module.exports = { RECIPIENT_SUMMARY_JOIN, RECIPIENT_SUMMARY_COLUMNS };
