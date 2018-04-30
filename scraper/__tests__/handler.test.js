const mockPutObject = jest.fn((data, callback) => {
  callback();
});
class mockS3 {
  putObject = mockPutObject;
}
jest.mock('aws-sdk', () => ({
  S3: mockS3,
}));
const { handler } = require('../handler');

describe('scraper', () => {
  it('should write to S3 with the correct data once for each day', async () => {
    fetch.mockResponse(`<html><body>
<div id="content-wrapper">
<div class="sqs-block-content">
<h2>Location<h2>
<h3>First item</h3>
<h3>Second item</h3>
</div>
    </body></html>`);
    await handler();

    expect(mockPutObject).toHaveBeenCalledTimes(9);
    expect(mockPutObject.mock.calls[0][0].Body).toEqual('lol');
  });
});
