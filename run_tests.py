import unittest
from processor import process_file


class ProcessorTests(unittest.TestCase):
    def test_csv_returns_list_of_records(self):
        results = process_file(b"supplier,product,price\nAcme,Widget,9.99")
        self.assertIsInstance(results, list)
        self.assertTrue(results)
        for record in results:
            self.assertIn("title", record)
            self.assertIn("status", record)
            self.assertIn("details", record)
            self.assertIn("due_date", record)
            self.assertIsInstance(record["details"], dict)

    def test_regex_extraction_title_is_named_insured(self):
        text = b"Named Insured: Beta Construction\nExpiration Date: 2025-01-01\nPolicy Number: XYZ123"
        results = process_file(text)
        self.assertEqual(results[0]["title"], "Beta Construction")
        self.assertEqual(results[0]["due_date"], "2025-01-01")

    def test_csv_compliance_field_title(self):
        csv_bytes = b"subcontractor company name,contact email,expiration/renewal date\nAcme,acme@example.com,2026-12-31"
        results = process_file(csv_bytes)
        self.assertEqual(results[0]["title"], "Acme")
        self.assertEqual(results[0]["due_date"], "2026-12-31")
        self.assertEqual(results[0]["details"]["contact_email"], "acme@example.com")


if __name__ == "__main__":
    unittest.main()
