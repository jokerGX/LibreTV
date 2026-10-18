import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectSavingCapability, memoryTarget, pickSaveTarget, UserCancelledError } from './download-saver';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function mobile(share = vi.fn(async () => {}), canShare = true) {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (iPhone) CriOS/140 Mobile',
    platform: 'iPhone', maxTouchPoints: 5,
    canShare: vi.fn(() => canShare), share,
  });
  return share;
}

describe('prepared download file', () => {
  it('only prepares the file at close: no automatic sharing or blob navigation', async () => {
    const share = mobile();
    const createURL = vi.spyOn(URL, 'createObjectURL');
    const target = memoryTarget('episode.mp4');
    const data = new Uint8Array([99, 1, 2, 88]);
    await target.write(data.subarray(1, 3));
    data.fill(0); // The writer may reuse its typed-array buffer.
    await target.close();
    expect(target.file?.name).toBe('episode.mp4');
    expect(target.file?.type).toBe('video/mp4');
    expect(new Uint8Array(await target.file!.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
    expect(share).not.toHaveBeenCalled();
    expect(createURL).not.toHaveBeenCalled();
  });

  it('invokes file sharing synchronously on explicit save and only then releases the file', async () => {
    let finish!: () => void;
    const share = mobile(vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })));
    const target = memoryTarget('episode.mp4');
    await target.write(new Uint8Array([1]));
    await target.close();
    const file = target.file;
    const saving = target.save!();
    expect(share).toHaveBeenCalledWith({ files: [file] });
    expect(target.file).toBe(file);
    finish();
    await saving;
    expect(target.file).toBeUndefined();
  });

  it('retains the generated file after sharing is cancelled, allowing another save gesture', async () => {
    const share = mobile(vi.fn()
      .mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
      .mockResolvedValueOnce(undefined));
    const target = memoryTarget('episode.mp4');
    await target.write(new Uint8Array([1, 2]));
    await target.close();
    const file = target.file;
    await expect(target.save!()).rejects.toMatchObject({ name: 'AbortError' });
    expect(target.file).toBe(file);
    await target.save!();
    expect(share).toHaveBeenCalledTimes(2);
    expect(target.file).toBeUndefined();
  });

  it('does not fall back to a broken blob navigation when iOS cannot share this file', async () => {
    const share = mobile(vi.fn(), false);
    const createURL = vi.spyOn(URL, 'createObjectURL');
    const target = memoryTarget('episode.mp4');
    await target.write(new Uint8Array([1]));
    await target.close();
    await expect(target.save!()).rejects.toThrow('无法分享');
    expect(share).not.toHaveBeenCalled();
    expect(createURL).not.toHaveBeenCalled();
    expect(target.file).toBeDefined();
    await target.abort();
    expect(target.file).toBeUndefined();
  });

  it('supports desktop download without replacing the current page', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { userAgent: 'Firefox', platform: 'Linux', maxTouchPoints: 0 });
    const anchor = { click: vi.fn(), remove: vi.fn(), href: '', download: '', target: '', rel: '' };
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const target = memoryTarget('episode.mp4');
    await target.write(new Uint8Array([1]));
    await target.close();
    expect(anchor.click).not.toHaveBeenCalled();
    await target.save!();
    expect(anchor.download).toBe('episode.mp4');
    expect(anchor.target).toBe('_blank');
    expect(anchor.click).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });

  it('automatically downloads desktop files without invoking a save picker or share menu', async () => {
    vi.useFakeTimers();
    const share = vi.fn();
    vi.stubGlobal('navigator', { userAgent: 'Chrome Windows', platform: 'Win32', maxTouchPoints: 0, share, canShare: () => true });
    const picker = vi.fn();
    vi.stubGlobal('window', { showSaveFilePicker: picker });
    const anchor = { click: vi.fn(), remove: vi.fn(), href: '', download: '', target: '', rel: '' };
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    const createURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const target = await pickSaveTarget('episode.mp4');
    await target.write(new Uint8Array([9, 1, 2, 8]).subarray(1, 3));
    expect(anchor.click).not.toHaveBeenCalled();
    await target.close();
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.download).toBe('episode.mp4');
    expect(picker).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    const file = createURL.mock.calls[0][0] as File;
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
    expect(target.file).toBeUndefined();
    await target.close();
    expect(anchor.click).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });

  it('keeps the mobile factory on explicit file sharing even if a picker exists', async () => {
    const share = mobile();
    const picker = vi.fn();
    vi.stubGlobal('window', { showSaveFilePicker: picker });
    const createURL = vi.spyOn(URL, 'createObjectURL');
    const target = await pickSaveTarget('episode.mp4');
    await target.write(new Uint8Array([1]));
    await target.close();
    expect(target.file).toBeDefined();
    expect(share).not.toHaveBeenCalled();
    expect(createURL).not.toHaveBeenCalled();
    expect(picker).not.toHaveBeenCalled();
    await target.save!();
    expect(share).toHaveBeenCalledOnce();
  });

  it('retains the large-file memory confirmation for browsers without streaming to disk', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Chrome Windows', platform: 'Win32', maxTouchPoints: 0 });
    vi.stubGlobal('window', { confirm: vi.fn(() => false) });
    await expect(pickSaveTarget('episode.mp4', 700 * 1024 * 1024)).rejects.toBeInstanceOf(UserCancelledError);
  });
});

describe('device-specific saving', () => {
  it.each([
    [{ userAgent: 'iPhone CriOS', platform: 'iPhone', maxTouchPoints: 5 }, 'manual'],
    [{ userAgent: 'Android Chrome', platform: 'Linux', maxTouchPoints: 5 }, 'manual'],
    [{ userAgent: 'Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 5 }, 'manual'],
    [{ userAgent: 'Windows Chrome', platform: 'Win32', maxTouchPoints: 10 }, 'automatic'],
    [{ userAgent: 'Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 0 }, 'automatic'],
    [{ userAgent: 'Linux Chrome', platform: 'Linux', maxTouchPoints: 0, userAgentData: { mobile: true } }, 'manual'],
    [{ userAgent: 'Linux Firefox', platform: 'Linux', maxTouchPoints: 0 }, 'automatic'],
  ] as const)('selects saving for %j', (navigator, expected) => {
    vi.stubGlobal('navigator', navigator);
    expect(detectSavingCapability()).toBe(expected);
  });

  it('uses the conservative manual mode before browser hydration', () => {
    vi.stubGlobal('navigator', undefined);
    expect(detectSavingCapability()).toBe('manual');
  });
});
