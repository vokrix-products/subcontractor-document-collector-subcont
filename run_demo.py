from processor import process_file

test_bytes = b"supplier,product,price\nAcme,Widget,9.99"
results = process_file(test_bytes)
assert isinstance(results, list)
print(results)
