import copy
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import engine

CASE = json.loads((Path(__file__).resolve().parents[1] / 'examples/case.json').read_text())


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.result = copy.deepcopy(CASE['result'])

    def check(self):
        return engine.validate(self.result, CASE['brief'], CASE['reply'])

    def test_reviewed_fixture_passes(self):
        self.assertEqual(len(self.check()['findings']), 5)

    def test_all_scenarios_have_valid_source_evidence(self):
        scenarios = json.loads((Path(__file__).resolve().parents[1] / 'examples/cases.json').read_text())
        for case in scenarios:
            with self.subTest(case=case['id']):
                engine.validate(case['result'], case['brief'], case['reply'])

    def test_invented_supplier_quote_is_rejected(self):
        self.result['findings'][0]['supplier_quote'] = 'Everything is approved.'
        with self.assertRaises(engine.AnalysisError): self.check()

    def test_invented_requirement_is_rejected(self):
        self.result['findings'][0]['requirement_quote'] = 'Must be waterproof.'
        with self.assertRaises(engine.AnalysisError): self.check()

    def test_silence_is_not_confirmation(self):
        self.result['findings'][-1]['status'] = 'aligned'
        with self.assertRaises(engine.AnalysisError): self.check()

    def test_missing_cannot_contain_supplier_quote(self):
        self.result['findings'][-1]['supplier_quote'] = 'Hi Kacper,'
        with self.assertRaises(engine.AnalysisError): self.check()

    def test_unresolved_item_needs_question(self):
        self.result['findings'][1]['question'] = ''
        with self.assertRaises(engine.AnalysisError): self.check()

    def test_empty_and_oversized_results_rejected(self):
        for rows in ([], self.result['findings'] * 5):
            with self.subTest(count=len(rows)), self.assertRaises(engine.AnalysisError):
                engine.validate({'findings': rows}, CASE['brief'], CASE['reply'])

    def test_unknown_status_rejected(self):
        self.result['findings'][0]['status'] = 'certified'
        with self.assertRaises(engine.AnalysisError): self.check()

    def test_live_request_uses_schema_and_validates_reply(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self): return json.dumps({'choices': [{'finish_reason':'stop', 'message': {'content':json.dumps(CASE['result'])}}]}).encode()
        with patch.dict('os.environ', {'OPENAI_API_KEY':'test-only'}), patch('urllib.request.urlopen', return_value=Response()) as call:
            result = engine.analyze(CASE['brief'], CASE['reply'])
            request = call.call_args.args[0]
            payload = json.loads(request.data)
            self.assertTrue(payload['response_format']['json_schema']['strict'])
            self.assertEqual(result, CASE['result'])

    def test_no_key_fails_explicitly(self):
        with patch.dict('os.environ', {}, clear=True), self.assertRaises(engine.AnalysisError):
            engine.analyze(CASE['brief'], CASE['reply'])

    def test_refusal_fails_explicitly(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self): return b'{"choices":[{"finish_reason":"stop","message":{"refusal":"no"}}]}'
        with patch.dict('os.environ', {'OPENAI_API_KEY':'test-only'}), patch('urllib.request.urlopen', return_value=Response()):
            with self.assertRaises(engine.AnalysisError): engine.analyze(CASE['brief'], CASE['reply'])


if __name__ == '__main__': unittest.main()
